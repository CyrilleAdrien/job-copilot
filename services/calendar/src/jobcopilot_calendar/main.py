"""Service calendar : entretiens et rendez-vous, export .ics et synchro CalDAV."""

from contextlib import asynccontextmanager

from fastapi import FastAPI

from jobcopilot_calendar.api import router
from jobcopilot_calendar.deps import get_http
from jobcopilot_calendar.migrate import upgrade
from jobcopilot_common import create_service_app, get_settings


@asynccontextmanager
async def lifespan(_app: FastAPI):
    await upgrade(get_settings().database_url)
    yield
    await get_http().aclose()


app = create_service_app("calendar", dependencies=["postgres", "redis"], lifespan=lifespan)
app.include_router(router)
