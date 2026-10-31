"""Événements Redis Streams : publiés à la création et au changement de statut,
et lecture de document.generated pour joindre les documents à la candidature
(ou la créer « À envoyer » quand l'offre n'en a pas encore)."""

import asyncio
import logging
from uuid import UUID

import httpx
from redis.asyncio import Redis
from redis.exceptions import ResponseError
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from jobcopilot_applications.models import ApplicationRow, StatusEventRow
from jobcopilot_applications.upstream import UpstreamError, contact_email, fetch_offer

APPLICATION_CREATED = "application.created"
STATUS_CHANGED = "application.status_changed"
DOCUMENT_GENERATED = "document.generated"
GROUP = "applications"
CONSUMER = "applications-1"

log = logging.getLogger(__name__)


async def publish(cache: Redis, stream: str, fields: dict[str, str | None]) -> None:
    """Un bus indisponible ne fait pas échouer la requête : on perd l'événement, pas la donnée."""
    try:
        await cache.xadd(stream, {k: v or "" for k, v in fields.items()}, maxlen=1000)
    except Exception:  # noqa: BLE001
        log.warning("événement %s non publié", stream, exc_info=True)


async def attach_documents(
    session: AsyncSession, fields: dict[str, str], http: httpx.AsyncClient | None = None
) -> tuple[ApplicationRow | None, bool]:
    """Joint le CV et la lettre générés à la candidature de l'offre.

    Sans candidature, et si `http` est fourni, la crée au statut « À envoyer » : un document
    généré sur le site signifie qu'on prépare cette candidature.
    Renvoie la candidature (ou None) et si elle vient d'être créée.
    """
    offer_id = fields.get("offer_id")
    if not offer_id or not offer_id.isdigit():
        return None, False
    row = await session.scalar(
        select(ApplicationRow).where(ApplicationRow.offer_id == int(offer_id))
    )
    created = row is None
    if row is None:
        if http is None:
            return None, False
        search = fields.get("search") or None
        try:
            offer = await fetch_offer(http, int(offer_id), search)
        except UpstreamError:
            log.warning("offre %s introuvable, candidature non créée", offer_id)
            return None, False
        row = ApplicationRow(
            offer_id=int(offer_id),
            search_id=search,
            title=offer["title"],
            company=offer.get("company"),
            location=offer.get("location"),
            url=offer.get("url"),
            source=offer.get("source"),
            description=offer.get("description"),
            contact_email=contact_email(offer.get("description")),
            status="draft",
            events=[StatusEventRow(from_status=None, to_status="draft", source="system")],
        )
        session.add(row)
    if fields.get("cv_id"):
        row.cv_document_id = UUID(fields["cv_id"])
    if fields.get("letter_id"):
        row.letter_document_id = UUID(fields["letter_id"])
    await session.commit()
    return row, created


async def consume(
    cache: Redis,
    sessions: async_sessionmaker[AsyncSession],
    http: httpx.AsyncClient | None = None,
    block_ms: int = 2000,
) -> None:
    """Boucle de lecture de document.generated, avec un groupe pour ne rien relire deux fois.

    L'attente (block_ms) reste sous le délai de lecture du client Redis (5 s par défaut).
    """
    try:
        await cache.xgroup_create(DOCUMENT_GENERATED, GROUP, id="$", mkstream=True)
    except ResponseError as exc:
        if "BUSYGROUP" not in str(exc):
            raise
    while True:
        try:
            batches = await cache.xreadgroup(
                GROUP, CONSUMER, {DOCUMENT_GENERATED: ">"}, count=20, block=block_ms
            )
            for _stream, messages in batches or []:
                for message_id, fields in messages:
                    async with sessions() as session:
                        row, created = await attach_documents(session, fields, http)
                        if row is not None and created:
                            await publish(
                                cache,
                                APPLICATION_CREATED,
                                {
                                    "application_id": str(row.id),
                                    "offer_id": str(row.offer_id),
                                    "status": row.status,
                                },
                            )
                    await cache.xack(DOCUMENT_GENERATED, GROUP, message_id)
        except asyncio.CancelledError:
            raise
        except Exception:  # noqa: BLE001
            log.warning(
                "lecture de %s interrompue, nouvel essai", DOCUMENT_GENERATED, exc_info=True
            )
            await asyncio.sleep(5)
