import asyncio
from datetime import UTC, datetime, timedelta
from typing import Annotated, Literal

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from jobcopilot_common.crypto import SecretKeyMissing, fernet
from jobcopilot_common.db import get_session
from jobcopilot_jobs import credentials, repository, service
from jobcopilot_jobs.connectors import Connector, FranceTravail, SourceError
from jobcopilot_jobs.connectors.france_travail import TOKEN_KEY
from jobcopilot_jobs.deps import Cache, Http, connector_for, get_connectors, get_criteria
from jobcopilot_jobs.matching import Match, score_offer
from jobcopilot_jobs.models import OfferRow
from jobcopilot_jobs.schemas import (
    Criteria,
    Offer,
    OfferDetail,
    OfferList,
    RefreshResult,
    SearchSettings,
    Sort,
    SourceInfo,
    SourceKeys,
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


def to_offer(
    row: OfferRow,
    criteria: Criteria,
    detail: bool = False,
    strict: bool = True,
    favorite: bool = False,
    match: Match | None = None,
) -> OfferDetail | Offer | None:
    """L'offre notée pour ce profil de recherche, ou None si elle est écartée.

    `strict=False` n'écarte rien : une fiche ouverte depuis un lien, ou depuis un autre
    profil de recherche, reste lisible.
    """
    match = match or score_offer(criteria, row.title, row.description, row.contract)
    if strict and (
        match.excluded or not match.on_topic or not match.enough_skills or match.too_senior
    ):
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
        "favorite": favorite,
    }
    return OfferDetail(**fields, description=row.description) if detail else Offer(**fields)


def score_window(
    rows: list[OfferRow], criteria: Criteria, starred: set[int]
) -> tuple[list[Offer], int, int]:
    """Note chaque offre une seule fois : les offres gardées et le nombre de celles écartées."""
    offers: list[Offer] = []
    below_threshold = above_level = 0
    for row in rows:
        match = score_offer(criteria, row.title, row.description, row.contract)
        if offer := to_offer(row, criteria, favorite=row.id in starred, match=match):
            offers.append(offer)
        elif match.on_topic and not match.excluded:
            below_threshold += not match.enough_skills
            above_level += match.enough_skills and match.too_senior
    return offers, below_threshold, above_level


@router.get("/offers", response_model=OfferList)
async def list_offers(
    session: Session,
    cache: Cache,
    criteria: Profile,
    max_age_days: Window,
    sort: Sort = "date",
    favorites: bool = False,
    limit: Annotated[int, Query(ge=1, le=200)] = 50,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> OfferList:
    """Offres de la fenêtre choisie (celle du profil par défaut), les plus récentes d'abord.

    `favorites=true` renvoie les favoris de la recherche, sans filtre de date ni de seuil.
    """
    days = max_age_days or criteria.max_age_days
    starred = await repository.favorite_ids(session, criteria.id)
    if favorites:
        rows = await repository.favorites(session, criteria.id)
        offers = [
            offer for row in rows if (offer := to_offer(row, criteria, strict=False, favorite=True))
        ]
        below_threshold = above_level = 0
    else:
        rows = await repository.offers_since(session, datetime.now(UTC) - timedelta(days=days))
        # Long sur une grande fenêtre : le service continue de répondre pendant le calcul.
        offers, below_threshold, above_level = await asyncio.to_thread(
            score_window, rows, criteria, starred
        )
    if sort == "date":
        offers.sort(key=lambda offer: (offer.published_at, offer.score), reverse=True)
    else:
        offers.sort(key=lambda offer: (offer.score, offer.published_at), reverse=True)
    refreshed_at = await cache.get(service.LAST_REFRESH)
    return OfferList(
        items=offers[offset : offset + limit],
        total=len(offers),
        search=criteria.id,
        hidden=below_threshold,
        hidden_level=above_level,
        sort=sort,
        max_age_days=days,
        refreshed_at=datetime.fromisoformat(refreshed_at) if refreshed_at else None,
    )


@router.get("/offers/{offer_id}", response_model=OfferDetail)
async def read_offer(offer_id: int, session: Session, criteria: Profile) -> OfferDetail:
    row = await repository.get_offer(session, offer_id)
    starred = await repository.favorite_ids(session, criteria.id)
    offer = (
        to_offer(row, criteria, detail=True, strict=False, favorite=row.id in starred)
        if row
        else None
    )
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
    """Interroge les sources. Le résultat reste en cache le délai des réglages, `force` l'ignore."""
    if max_age_days:
        criteria = criteria.model_copy(update={"max_age_days": max_age_days})
    try:
        ttl = await credentials.refresh_minutes(session) * 60
        return await service.refresh(session, cache, criteria, connectors, force=force, ttl=ttl)
    except service.RefreshInProgress as exc:
        raise HTTPException(
            status.HTTP_409_CONFLICT, "Une actualisation est déjà en cours."
        ) from exc


@router.put("/offers/{offer_id}/favorite", status_code=status.HTTP_204_NO_CONTENT)
async def add_favorite(offer_id: int, session: Session, criteria: Profile) -> None:
    """Met l'offre en favori pour la recherche choisie (paramètre `search`)."""
    if await repository.get_offer(session, offer_id) is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Offre introuvable.")
    await repository.set_favorite(session, criteria.id, offer_id, True)


@router.delete("/offers/{offer_id}/favorite", status_code=status.HTTP_204_NO_CONTENT)
async def remove_favorite(offer_id: int, session: Session, criteria: Profile) -> None:
    await repository.set_favorite(session, criteria.id, offer_id, False)


@router.get("/sources", response_model=list[SourceInfo])
async def list_sources(connectors: Connectors, session: Session) -> list[SourceInfo]:
    stored = await credentials.stored_names(session)
    return [
        SourceInfo(
            name=c.name,
            label=c.label,
            configured=c.configured(),
            origin=("settings" if c.name in stored else "env") if c.configured() else None,
        )
        for c in connectors
    ]


def source_info(connector: Connector, origin: Literal["settings", "env"] | None) -> SourceInfo:
    return SourceInfo(
        name=connector.name,
        label=connector.label,
        configured=connector.configured(),
        origin=origin,
    )


async def verify(connector: Connector) -> None:
    try:
        await connector.check()
    except SourceError as exc:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, f"{str(exc).capitalize()}.") from exc


@router.put("/sources/{name}", response_model=SourceInfo)
async def save_source_keys(
    name: str, keys: SourceKeys, session: Session, cache: Cache, http: Http
) -> SourceInfo:
    """Teste les clés, puis les chiffre. Des clés refusées ne sont pas enregistrées."""
    connector = connector_for(name, cache, http, keys.key_id.strip(), keys.secret.strip())
    if connector is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Source inconnue.")
    await verify(connector)
    try:
        await credentials.save(session, name, keys.key_id.strip(), keys.secret.strip())
    except SecretKeyMissing as exc:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, str(exc)) from exc
    return source_info(connector, "settings")


@router.post("/sources/{name}/test", response_model=SourceInfo)
async def test_source_keys(name: str, connectors: Connectors, session: Session) -> SourceInfo:
    connector = next((c for c in connectors if c.name == name), None)
    if connector is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Source inconnue.")
    if not connector.configured():
        raise HTTPException(status.HTTP_409_CONFLICT, "Aucune clé pour cette source.")
    await verify(connector)
    stored = await credentials.stored_names(session)
    return source_info(connector, "settings" if name in stored else "env")


@router.delete("/sources/{name}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_source_keys(name: str, session: Session, cache: Cache) -> None:
    """Retire les clés des réglages. Celles de .env, s'il y en a, reprennent la main."""
    await credentials.remove(session, name)
    if name == FranceTravail.name:
        await cache.delete(TOKEN_KEY)


async def search_settings_out(session: AsyncSession) -> SearchSettings:
    try:
        fernet()
        encryption = True
    except SecretKeyMissing:
        encryption = False
    return SearchSettings(
        refresh_minutes=await credentials.refresh_minutes(session), encryption=encryption
    )


@router.get("/search-settings", response_model=SearchSettings)
async def read_search_settings(session: Session) -> SearchSettings:
    return await search_settings_out(session)


@router.put("/search-settings", response_model=SearchSettings)
async def write_search_settings(payload: SearchSettings, session: Session) -> SearchSettings:
    await credentials.set_refresh_minutes(session, payload.refresh_minutes)
    return await search_settings_out(session)
