from contextlib import asynccontextmanager

from fastapi import FastAPI

from jobcopilot_common import create_service_app, get_settings
from jobcopilot_common.data import data_router
from jobcopilot_profile.api import router
from jobcopilot_profile.migrate import upgrade
from jobcopilot_profile.models import Base


@asynccontextmanager
async def lifespan(_app: FastAPI):
    await upgrade(get_settings().database_url)
    yield


app = create_service_app("profile", dependencies=["postgres", "redis"], lifespan=lifespan)
app.include_router(router)
app.include_router(data_router(Base))
