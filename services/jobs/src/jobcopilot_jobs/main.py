from contextlib import asynccontextmanager

from fastapi import FastAPI

from jobcopilot_common import create_service_app, get_settings
from jobcopilot_jobs.api import router
from jobcopilot_jobs.deps import get_cache, get_http
from jobcopilot_jobs.migrate import upgrade


@asynccontextmanager
async def lifespan(_app: FastAPI):
    await upgrade(get_settings().database_url)
    yield
    await get_http().aclose()
    await get_cache().aclose()


app = create_service_app("jobs", dependencies=["postgres", "redis"], lifespan=lifespan)
app.include_router(router)
