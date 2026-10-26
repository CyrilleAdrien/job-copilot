"""Vérifications des dépendances d'un service (Postgres, Redis, S3, Ollama)."""

import asyncio
from collections.abc import Awaitable, Callable

import asyncpg
import httpx
from redis.asyncio import Redis

from jobcopilot_common.config import Settings

Check = Callable[[Settings], Awaitable[None]]


async def check_postgres(settings: Settings) -> None:
    conn = await asyncpg.connect(settings.database_url, timeout=settings.check_timeout)
    try:
        await conn.fetchval("SELECT 1")
    finally:
        await conn.close()


async def check_redis(settings: Settings) -> None:
    client = Redis.from_url(settings.redis_url, socket_timeout=settings.check_timeout)
    try:
        await client.ping()
    finally:
        await client.aclose()


async def check_s3(settings: Settings) -> None:
    # Toute réponse HTTP hors 5xx prouve que le stockage répond, quelle que soit
    # l'implémentation S3 : une requête anonyme reçoit souvent 403.
    async with httpx.AsyncClient(timeout=settings.check_timeout) as client:
        response = await client.get(settings.s3_endpoint)
    if response.status_code >= 500:
        response.raise_for_status()


async def check_ollama(settings: Settings) -> None:
    async with httpx.AsyncClient(timeout=settings.check_timeout) as client:
        response = await client.get(f"{settings.ollama_url}/api/version")
        response.raise_for_status()


CHECKS: dict[str, Check] = {
    "postgres": check_postgres,
    "redis": check_redis,
    "s3": check_s3,
    "ollama": check_ollama,
}


async def run_checks(names: list[str], settings: Settings) -> dict[str, str]:
    """Lance les vérifications en parallèle et renvoie "ok" ou le message d'erreur."""

    async def run(name: str) -> str:
        try:
            await asyncio.wait_for(CHECKS[name](settings), timeout=settings.check_timeout + 1)
        except Exception as exc:  # noqa: BLE001 - toute erreur rend la dépendance indisponible
            return f"error: {type(exc).__name__}"
        return "ok"

    results = await asyncio.gather(*(run(name) for name in names))
    return dict(zip(names, results, strict=True))
