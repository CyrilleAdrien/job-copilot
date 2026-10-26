from datetime import UTC, datetime, timedelta
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from jobcopilot_common.db import get_session
from jobcopilot_jobs import repository, service
from jobcopilot_jobs.connectors import Connector
from jobcopilot_jobs.deps import Cache, get_connectors, get_criteria
from jobcopilot_jobs.matching import score_offer
from jobcopilot_jobs.models import OfferRow
from jobcopilot_jobs.schemas import (
    Criteria,
    Offer,
    OfferDetail,
    OfferList,
    RefreshResult,
    Sort,
    SourceInfo,
)

WINDOWS = (1, 3, 7, 14, 30)


router = APIRouter(tags=["jobs"])
Session = Annotated[AsyncSession, Depends(get_session)]
Profile = Annotated[Criteria, Depends(get_criteria)]
Connectors = Annotated[list[Connector], Depends(get_connectors)]


def window(max_age_days: int | None = None) -> int | None:
    """Fenêtre de publication demandée : 1, 3, 7, 14 ou 30 jours (celle du profil sinon)."""
    if max_age_days is not None and max_age_days not in WINDOWS:
        raise HTTPException(422, "max_age_days doit valoir 1, 3, 7, 14 ou 30.")
    return max_age_days


Window = Annotated[int | None, Depends(window)]


def snippet(description: str, length: int = 240) -> str:
    text = " ".join(description.split())
    return text if len(text) <= length else text[:length].rsplit(" ", 1)[0] + "…"


def to_offer(row: OfferRow, criteria: Criteria, detail: bool = False) -> OfferDetail | Offer | None:
    match = score_offer(criteria, row.title, row.description, row.contract)
    if match.excluded or not match.on_topic:
        return None
    fields = {
        "id": row.id,
        "source": row.source,
        "title": row.title,
        "company": row.company,
        "location": row.location,
        "contract": row.contract,
        "salary": row.salary,
        "url": row.url,
        "published_at": row.published_at,
        "snippet": snippet(row.description),
        "score": match.score,
        "matched": match.matched,
        "remote": match.remote,
    }
    return OfferDetail(**fields, description=row.description) if detail else Offer(**fields)


@router.get("/offers", response_model=OfferList)
async def list_offers(
    session: Session,
    cache: Cache,
    criteria: Profile,
    max_age_days: Window,
    sort: Sort = "date",
    limit: Annotated[int, Query(ge=1, le=200)] = 50,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> OfferList:
    """Offres de la fenêtre choisie (celle du profil par défaut), les plus récentes d'abord."""
    days = max_age_days or criteria.max_age_days
    rows = await repository.offers_since(session, datetime.now(UTC) - timedelta(days=days))
    offers = [offer for row in rows if (offer := to_offer(row, criteria))]
    if sort == "date":
        offers.sort(key=lambda offer: (offer.published_at, offer.score), reverse=True)
    else:
        offers.sort(key=lambda offer: (offer.score, offer.published_at), reverse=True)
    refreshed_at = await cache.get(service.LAST_REFRESH)
    return OfferList(
        items=offers[offset : offset + limit],
        total=len(offers),
        sort=sort,
        max_age_days=days,
        refreshed_at=datetime.fromisoformat(refreshed_at) if refreshed_at else None,
    )


@router.get("/offers/{offer_id}", response_model=OfferDetail)
async def read_offer(offer_id: int, session: Session, criteria: Profile) -> OfferDetail:
    row = await repository.get_offer(session, offer_id)
    offer = to_offer(row, criteria, detail=True) if row else None
    if offer is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Offre introuvable.")
    return offer


@router.post("/refresh", response_model=RefreshResult)
async def refresh_offers(
    session: Session,
    cache: Cache,
    criteria: Profile,
    connectors: Connectors,
    max_age_days: Window,
    force: bool = False,
) -> RefreshResult:
    """Interroge les sources. Le résultat est mis en cache 15 minutes, `force` l'ignore."""
    if max_age_days:
        criteria = criteria.model_copy(update={"max_age_days": max_age_days})
    try:
        return await service.refresh(session, cache, criteria, connectors, force=force)
    except service.RefreshInProgress as exc:
        raise HTTPException(
            status.HTTP_409_CONFLICT, "Une actualisation est déjà en cours."
        ) from exc


@router.get("/sources", response_model=list[SourceInfo])
async def list_sources(connectors: Connectors) -> list[SourceInfo]:
    return [SourceInfo(name=c.name, label=c.label, configured=c.configured()) for c in connectors]
