"""Dépendances FastAPI du service : cache, client HTTP, sources et critères du profil."""

from functools import lru_cache
from typing import Annotated

import httpx
from fastapi import Depends, HTTPException, status
from redis.asyncio import Redis

from jobcopilot_common import get_settings
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


def get_connectors(cache: Cache, http: Http) -> list[Connector]:
    """Sources par ordre de préférence : en cas de doublon, la première est gardée."""
    settings = get_jobs_settings()
    connectors: list[Connector] = [
        FranceTravail(
            http, cache, settings.france_travail_client_id, settings.france_travail_client_secret
        ),
        Adzuna(http, settings.adzuna_app_id, settings.adzuna_app_key),
    ]
    if settings.jobs_demo:
        connectors.append(Demo())
    return connectors


async def get_criteria(http: Http) -> Criteria:
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
    return Criteria.model_validate(response.json()["search"])
