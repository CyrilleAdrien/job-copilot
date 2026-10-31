"""Service applications : candidatures, statuts et historique."""

import asyncio
import contextlib
from contextlib import asynccontextmanager

from fastapi import FastAPI

from jobcopilot_applications.api import router
from jobcopilot_applications.deps import get_cache, get_http
from jobcopilot_applications.events import consume
from jobcopilot_applications.migrate import upgrade
from jobcopilot_applications.settings import get_applications_settings
from jobcopilot_common import create_service_app, get_settings
from jobcopilot_common.db import get_sessionmaker


@asynccontextmanager
async def lifespan(_app: FastAPI):
    await upgrade(get_settings().database_url)
    consumer = None
    if get_applications_settings().applications_consume_events:
        consumer = asyncio.create_task(consume(get_cache(), get_sessionmaker()))
    yield
    if consumer:
        consumer.cancel()
        with contextlib.suppress(asyncio.CancelledError):
            await consumer
    await get_http().aclose()
    await get_cache().aclose()


app = create_service_app("applications", dependencies=["postgres", "redis"], lifespan=lifespan)
app.include_router(router)
