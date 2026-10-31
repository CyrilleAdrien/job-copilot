"""Événements Redis Streams : publiés à la création et au changement de statut,
et lecture de document.generated pour joindre les documents à la candidature."""

import asyncio
import logging
from uuid import UUID

from redis.asyncio import Redis
from redis.exceptions import ResponseError
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from jobcopilot_applications.models import ApplicationRow

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


async def attach_documents(session: AsyncSession, fields: dict[str, str]) -> bool:
    """Joint le CV et la lettre générés à la candidature de l'offre, si elle existe."""
    offer_id = fields.get("offer_id")
    if not offer_id or not offer_id.isdigit():
        return False
    row = await session.scalar(
        select(ApplicationRow).where(ApplicationRow.offer_id == int(offer_id))
    )
    if row is None:
        return False
    if fields.get("cv_id"):
        row.cv_document_id = UUID(fields["cv_id"])
    if fields.get("letter_id"):
        row.letter_document_id = UUID(fields["letter_id"])
    await session.commit()
    return True


async def consume(
    cache: Redis, sessions: async_sessionmaker[AsyncSession], block_ms: int = 2000
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
                        await attach_documents(session, fields)
                    await cache.xack(DOCUMENT_GENERATED, GROUP, message_id)
        except asyncio.CancelledError:
            raise
        except Exception:  # noqa: BLE001
            log.warning(
                "lecture de %s interrompue, nouvel essai", DOCUMENT_GENERATED, exc_info=True
            )
            await asyncio.sleep(5)
