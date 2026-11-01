"""Export et suppression des données d'un service, pour l'export RGPD et le « tout supprimer ».

Les tables viennent des métadonnées SQLAlchemy : une nouvelle table est couverte d'office.
Les secrets et les binaires ne sortent jamais de la base par l'export.
"""

from collections.abc import Awaitable, Callable, Iterable
from typing import Annotated, Any

from fastapi import APIRouter, Depends, status
from redis.asyncio import Redis
from sqlalchemy import Column, LargeBinary, Table, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import DeclarativeBase

from jobcopilot_common.db import get_session

SECRET_HINTS = ("password", "secret", "token", "api_key")

Session = Annotated[AsyncSession, Depends(get_session)]


def is_exportable(column: Column[Any]) -> bool:
    name = column.name.lower()
    return not isinstance(column.type, LargeBinary) and not any(
        hint in name for hint in SECRET_HINTS
    )


async def export_tables(session: AsyncSession, tables: Iterable[Table]) -> dict[str, list[dict]]:
    exported: dict[str, list[dict]] = {}
    for table in tables:
        columns = [column for column in table.columns if is_exportable(column)]
        result = await session.execute(select(*columns))
        exported[table.name] = [dict(row) for row in result.mappings()]
    return exported


async def clear_cache(
    cache: Redis, prefixes: Iterable[str] = (), streams: Iterable[str] = ()
) -> None:
    """Vide les clés d'un service. Les flux sont vidés sans être supprimés : leurs groupes de
    lecture, créés au démarrage des services, doivent rester en place."""
    for prefix in prefixes:
        async for key in cache.scan_iter(match=f"{prefix}*"):
            await cache.delete(key)
    for stream in streams:
        await cache.xtrim(stream, maxlen=0, approximate=False)


def data_router(
    base: type[DeclarativeBase],
    before_erase: Callable[[AsyncSession], Awaitable[None]] | None = None,
    after_erase: Callable[[], Awaitable[None]] | None = None,
) -> APIRouter:
    """Ajoute GET /data/export et DELETE /data à un service.

    `before_erase` retire ce qui vit hors de la base en s'appuyant sur elle : s'il échoue,
    les lignes restent et la suppression peut être relancée.
    """
    router = APIRouter(tags=["data"])

    @router.get("/data/export")
    async def export(session: Session) -> dict[str, list[dict]]:
        return await export_tables(session, base.metadata.sorted_tables)

    @router.delete("/data", status_code=status.HTTP_204_NO_CONTENT)
    async def erase(session: Session) -> None:
        if before_erase is not None:
            await before_erase(session)
        for table in reversed(base.metadata.sorted_tables):
            await session.execute(table.delete())
        await session.commit()
        if after_erase is not None:
            await after_erase()

    return router
