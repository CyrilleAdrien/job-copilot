"""Collecte : interroge les sources, filtre la fenêtre de publication, enregistre."""

import asyncio
import hashlib
import json
from datetime import UTC, datetime, timedelta

import httpx
from redis.asyncio import Redis
from sqlalchemy.ext.asyncio import AsyncSession

from jobcopilot_jobs import repository
from jobcopilot_jobs.connectors import Connector, SourceError
from jobcopilot_jobs.schemas import Criteria, Query, RawOffer, RefreshResult, SourceStatus
from jobcopilot_jobs.settings import get_jobs_settings

LAST_REFRESH = "jobs:last_refresh"
LOCK = "jobs:refresh:lock"


class RefreshInProgress(Exception):
    pass


def build_queries(criteria: Criteria) -> list[Query]:
    """Un intitulé par requête (les sources combinent les mots-clés en ET), trois au plus."""
    locations: list[str | None] = list(criteria.locations[:3]) or [None]
    return [
        Query(
            keywords=role,
            location=location,
            radius_km=criteria.radius_km,
            max_age_days=criteria.max_age_days,
            contract_types=criteria.contract_types,
        )
        for role in criteria.roles[:3]
        for location in locations
    ]


def cache_key(criteria: Criteria, connectors: list[Connector]) -> str:
    fields = criteria.model_dump(
        include={"roles", "locations", "radius_km", "max_age_days", "contract_types"}
    )
    fields["sources"] = sorted(c.name for c in connectors if c.configured())
    digest = hashlib.sha1(json.dumps(fields, sort_keys=True).encode()).hexdigest()[:16]
    return f"jobs:refresh:{digest}"


async def collect(
    connectors: list[Connector], queries: list[Query], since: datetime
) -> tuple[list[RawOffer], list[SourceStatus]]:
    offers: list[RawOffer] = []
    statuses: list[SourceStatus] = []
    for connector in connectors:
        status = SourceStatus(name=connector.name, label=connector.label, status="disabled")
        if connector.configured():
            try:
                results = await asyncio.gather(*(connector.search(q) for q in queries))
            except SourceError as exc:
                status.status, status.error = "error", str(exc)
            except httpx.HTTPError:
                status.status, status.error = "error", "source injoignable"
            else:
                found = [o for batch in results for o in batch if o.published_at >= since]
                status.status, status.count = "ok", len(found)
                offers.extend(found)
        statuses.append(status)
    return offers, statuses


async def refresh(
    session: AsyncSession,
    cache: Redis,
    criteria: Criteria,
    connectors: list[Connector],
    force: bool = False,
    ttl: int | None = None,
) -> RefreshResult:
    settings = get_jobs_settings()
    key = cache_key(criteria, connectors)
    if not force and (cached := await cache.get(key)):
        return RefreshResult.model_validate_json(cached).model_copy(update={"cached": True})
    if not await cache.set(LOCK, "1", nx=True, ex=120):
        raise RefreshInProgress
    try:
        now = datetime.now(UTC)
        since = now - timedelta(days=criteria.max_age_days)
        offers, statuses = await collect(connectors, build_queries(criteria), since)
        stored, duplicates = await repository.store_offers(session, offers)
        await repository.purge_before(session, now - timedelta(days=settings.jobs_retention_days))
        result = RefreshResult(
            refreshed_at=now,
            fetched=len(offers),
            stored=stored,
            duplicates=duplicates,
            sources=statuses,
        )
        # Une source en erreur sera réessayée au prochain appel, sans attendre l'expiration.
        if all(status.status != "error" for status in statuses):
            await cache.set(key, result.model_dump_json(), ex=ttl or settings.jobs_refresh_ttl)
        await cache.set(LAST_REFRESH, now.isoformat())
        return result
    finally:
        await cache.delete(LOCK)
