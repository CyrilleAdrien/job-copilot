from datetime import datetime

from sqlalchemy import delete, select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from jobcopilot_jobs.matching import dedup_key
from jobcopilot_jobs.models import FavoriteRow, OfferRow
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
    """Supprime les vieilles offres, sauf celles mises en favori."""
    await session.execute(
        delete(OfferRow).where(
            OfferRow.published_at < before, OfferRow.id.not_in(select(FavoriteRow.offer_id))
        )
    )
    await session.commit()


async def favorite_ids(session: AsyncSession, search_id: str) -> set[int]:
    result = await session.scalars(
        select(FavoriteRow.offer_id).where(FavoriteRow.search_id == search_id)
    )
    return set(result)


async def favorites(session: AsyncSession, search_id: str) -> list[OfferRow]:
    """Favoris de la recherche, quelle que soit leur date de publication."""
    result = await session.scalars(
        select(OfferRow)
        .join(FavoriteRow, FavoriteRow.offer_id == OfferRow.id)
        .where(FavoriteRow.search_id == search_id)
    )
    return list(result)


async def set_favorite(session: AsyncSession, search_id: str, offer_id: int, on: bool) -> None:
    if on:
        statement = insert(FavoriteRow).values(search_id=search_id, offer_id=offer_id)
        await session.execute(statement.on_conflict_do_nothing())
    else:
        await session.execute(
            delete(FavoriteRow).where(
                FavoriteRow.search_id == search_id, FavoriteRow.offer_id == offer_id
            )
        )
    await session.commit()
