"""Accès Postgres asynchrone partagé par les services (SQLAlchemy 2 + asyncpg)."""

from collections.abc import AsyncIterator
from functools import lru_cache

from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)

from jobcopilot_common.config import get_settings


def async_url(url: str) -> str:
    """Convertit une URL postgresql:// en URL du pilote asyncpg."""
    return url.replace("postgresql://", "postgresql+asyncpg://", 1)


@lru_cache
def get_engine() -> AsyncEngine:
    return create_async_engine(async_url(get_settings().database_url), pool_pre_ping=True)


@lru_cache
def get_sessionmaker() -> async_sessionmaker[AsyncSession]:
    return async_sessionmaker(get_engine(), expire_on_commit=False)


async def get_session() -> AsyncIterator[AsyncSession]:
    """Dépendance FastAPI : une session par requête."""
    async with get_sessionmaker()() as session:
        yield session
