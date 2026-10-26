from datetime import datetime

from sqlalchemy import delete, select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from jobcopilot_jobs.matching import dedup_key
from jobcopilot_jobs.models import OfferRow
from jobcopilot_jobs.schemas import RawOffer

UPDATED = ["title", "company", "location", "contract", "salary", "description", "url"]


async def store_offers(session: AsyncSession, offers: list[RawOffer]) -> tuple[int, int]:
    """Enregistre les offres et renvoie (stockées, doublons écartés).

    Une offre déjà vue chez une autre source (même clé de dédoublonnage) est écartée :
    les sources sont parcourues par ordre de préférence, la première gagne.
    """
    batch: dict[str, RawOffer] = {}
    for offer in offers:
        batch.setdefault(dedup_key(offer.title, offer.company, offer.location), offer)
    if not batch:
        return 0, len(offers)

    existing = await session.execute(
        select(OfferRow.dedup_key, OfferRow.source, OfferRow.external_id).where(
            OfferRow.dedup_key.in_(batch.keys())
        )
    )
    taken = {key: (source, external_id) for key, source, external_id in existing}
    rows = [
        {**offer.model_dump(), "dedup_key": key}
        for key, offer in batch.items()
        if taken.get(key, (offer.source, offer.external_id)) == (offer.source, offer.external_id)
    ]
    if rows:
        statement = insert(OfferRow).values(rows)
        statement = statement.on_conflict_do_update(
            constraint="offers_source_external_id_key",
            set_={column: statement.excluded[column] for column in UPDATED},
        )
        await session.execute(statement)
    await session.commit()
    return len(rows), len(offers) - len(rows)


async def offers_since(session: AsyncSession, since: datetime) -> list[OfferRow]:
    result = await session.scalars(select(OfferRow).where(OfferRow.published_at >= since))
    return list(result)


async def get_offer(session: AsyncSession, offer_id: int) -> OfferRow | None:
    return await session.get(OfferRow, offer_id)


async def purge_before(session: AsyncSession, before: datetime) -> None:
    await session.execute(delete(OfferRow).where(OfferRow.published_at < before))
    await session.commit()
