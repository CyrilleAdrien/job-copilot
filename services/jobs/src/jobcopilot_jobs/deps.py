"""Dépendances FastAPI du service : cache, client HTTP, sources et critères du profil."""

from functools import lru_cache
from typing import Annotated

import httpx
from fastapi import Depends, HTTPException, Query, status
from redis.asyncio import Redis
from sqlalchemy.ext.asyncio import AsyncSession

from jobcopilot_common import get_settings
from jobcopilot_common.db import get_session
from jobcopilot_jobs import credentials
from jobcopilot_jobs.connectors import Adzuna, Connector, Demo, FranceTravail
from jobcopilot_jobs.schemas import Criteria
from jobcopilot_jobs.settings import get_jobs_settings


@lru_cache
def get_cache() -> Redis:
    return Redis.from_url(get_settings().redis_url, decode_responses=True)


@lru_cache
def get_http() -> httpx.AsyncClient:
    return httpx.AsyncClient(timeout=get_jobs_settings().jobs_http_timeout)


Cache = Annotated[Redis, Depends(get_cache)]
Http = Annotated[httpx.AsyncClient, Depends(get_http)]


def connector_for(name: str, cache: Redis, http: httpx.AsyncClient, key_id: str, secret: str):
    """Une source avec les clés données, pour les tester avant de les enregistrer."""
    match name:
        case FranceTravail.name:
            return FranceTravail(http, cache, key_id, secret)
        case Adzuna.name:
            return Adzuna(http, key_id, secret)
    return None


async def get_connectors(
    cache: Cache, http: Http, session: Annotated[AsyncSession, Depends(get_session)]
) -> list[Connector]:
    """Sources par ordre de préférence : en cas de doublon, la première est gardée.

    Les clés des réglages priment sur celles de .env.
    """
    settings = get_jobs_settings()
    stored = await credentials.load(session)
    france_travail = stored.get(
        FranceTravail.name,
        (settings.france_travail_client_id, settings.france_travail_client_secret),
    )
    adzuna = stored.get(Adzuna.name, (settings.adzuna_app_id, settings.adzuna_app_key))
    connectors: list[Connector] = [
        FranceTravail(http, cache, *france_travail),
        Adzuna(http, *adzuna),
    ]
    if settings.jobs_demo:
        connectors.append(Demo())
    return connectors


async def get_criteria(
    http: Http,
    search: Annotated[
        str | None, Query(description="Profil de recherche (le premier sinon)")
    ] = None,
) -> Criteria:
    try:
        response = await http.get(f"{get_jobs_settings().profile_url}/")
    except httpx.HTTPError as exc:
        raise HTTPException(status.HTTP_502_BAD_GATEWAY, "Service profil injoignable.") from exc
    if response.status_code == 404:
        raise HTTPException(
            status.HTTP_409_CONFLICT, "Configure ton profil avant de chercher des offres."
        )
    if response.status_code != 200:
        raise HTTPException(status.HTTP_502_BAD_GATEWAY, "Service profil indisponible.")
    searches = [Criteria.model_validate(item) for item in response.json()["searches"]]
    if search is None:
        # La première recherche active ; une recherche archivée reste lisible par son identifiant.
        return next((item for item in searches if not item.archived), searches[0])
    for criteria in searches:
        if criteria.id == search:
            return criteria
    raise HTTPException(status.HTTP_404_NOT_FOUND, "Profil de recherche introuvable.")
