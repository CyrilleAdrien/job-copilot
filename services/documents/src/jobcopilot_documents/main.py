from contextlib import asynccontextmanager

from fastapi import FastAPI
from sqlalchemy import update
from sqlalchemy.ext.asyncio import AsyncSession

from jobcopilot_common import create_service_app, get_settings
from jobcopilot_common.data import clear_cache, data_router
from jobcopilot_common.db import get_sessionmaker
from jobcopilot_documents.api import router
from jobcopilot_documents.deps import get_cache
from jobcopilot_documents.migrate import upgrade
from jobcopilot_documents.models import Base, GenerationRow
from jobcopilot_documents.pipeline import EVENTS_STREAM
from jobcopilot_documents.storage import get_storage


@asynccontextmanager
async def lifespan(_app: FastAPI):
    await upgrade(get_settings().database_url)
    # Une génération en cours lors d'un arrêt ne reprendra pas : on le dit plutôt que d'attendre.
    async with get_sessionmaker()() as session:
        await session.execute(
            update(GenerationRow)
            .where(GenerationRow.status == "running")
            .values(status="error", error="Génération interrompue par un redémarrage.")
        )
        await session.commit()
    yield


app = create_service_app(
    "documents", dependencies=["postgres", "redis", "s3", "ollama"], lifespan=lifespan
)
app.include_router(router)


async def delete_files(_session: AsyncSession) -> None:
    await get_storage().clear()


async def clear_documents_cache() -> None:
    await clear_cache(get_cache(), streams=[EVENTS_STREAM])


app.include_router(data_router(Base, before_erase=delete_files, after_erase=clear_documents_cache))
