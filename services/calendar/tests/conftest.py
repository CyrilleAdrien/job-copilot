import os

import pytest
from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine

TEST_DATABASE_URL = os.environ.setdefault(
    "TEST_DATABASE_URL", "postgresql://postgres@127.0.0.1:5433/jobcopilot_test"
)
os.environ["DATABASE_URL"] = TEST_DATABASE_URL
os.environ["CALENDAR_DEMO"] = "true"
os.environ["SECRET_KEY"] = "test-secret-key-for-calendar-service"

from jobcopilot_calendar.migrate import upgrade  # noqa: E402
from jobcopilot_common.db import async_url, get_engine, get_sessionmaker  # noqa: E402


@pytest.fixture
async def database():
    engine = create_async_engine(async_url(TEST_DATABASE_URL))
    async with engine.begin() as connection:
        await connection.execute(text('DROP SCHEMA IF EXISTS "calendar" CASCADE'))
    await engine.dispose()
    await upgrade(TEST_DATABASE_URL)
    yield
    await get_engine().dispose()
    get_sessionmaker.cache_clear()
    get_engine.cache_clear()
