from contextlib import asynccontextmanager

from fastapi import FastAPI

from jobcopilot_common import create_service_app, get_settings
from jobcopilot_common.data import clear_cache, data_router
from jobcopilot_jobs.api import router
from jobcopilot_jobs.deps import get_cache, get_http
from jobcopilot_jobs.migrate import upgrade
from jobcopilot_jobs.models import Base


@asynccontextmanager
async def lifespan(_app: FastAPI):
    await upgrade(get_settings().database_url)
    yield
    await get_http().aclose()
    await get_cache().aclose()


app = create_service_app("jobs", dependencies=["postgres", "redis"], lifespan=lifespan)
app.include_router(router)


async def clear_jobs_cache() -> None:
    await clear_cache(get_cache(), prefixes=["jobs:"])


app.include_router(data_router(Base, after_erase=clear_jobs_cache))
