from contextlib import asynccontextmanager

from fastapi import FastAPI
from sqlalchemy import update

from jobcopilot_common import create_service_app, get_settings
from jobcopilot_common.db import get_sessionmaker
from jobcopilot_documents.api import router
from jobcopilot_documents.migrate import upgrade
from jobcopilot_documents.models import GenerationRow


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
