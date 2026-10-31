import asyncio
import os

from alembic import command
from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine

from jobcopilot_common.db import async_url
from jobcopilot_profile.migrate import alembic_config

# Fixée par conftest.py, chargé avant ce module.
TEST_DATABASE_URL = os.environ["TEST_DATABASE_URL"]


async def run(revision: str, down: bool = False) -> None:
    action = command.downgrade if down else command.upgrade
    await asyncio.to_thread(action, alembic_config(TEST_DATABASE_URL), revision)


async def test_single_search_becomes_first_search_profile():
    engine = create_async_engine(async_url(TEST_DATABASE_URL))
    async with engine.begin() as connection:
        await connection.execute(text('DROP SCHEMA IF EXISTS "profile" CASCADE'))
    await run("0001")
    async with engine.begin() as connection:
        await connection.execute(
            text("INSERT INTO profile.profiles (id, full_name, headline) VALUES (1, 'A', 'B')")
        )
        await connection.execute(
            text(
                "INSERT INTO profile.search_criteria (profile_id, roles, seniority, radius_km,"
                " remote, max_age_days) VALUES (1, '[\"DevOps\"]', 'mid', 30, 'any', 14)"
            )
        )
    await run("head")
    async with engine.connect() as connection:
        result = await connection.execute(text("SELECT searches FROM profile.profiles"))
        searches = result.one()[0]
    assert searches[0]["id"] == "principal"
    assert searches[0]["roles"] == ["DevOps"]
    assert searches[0]["max_age_days"] == 14
    assert searches[0]["match_mode"] == "domain"

    await run("0001", down=True)
    async with engine.connect() as connection:
        days = (
            await connection.execute(text("SELECT max_age_days FROM profile.search_criteria"))
        ).one()[0]
    assert days == 14
    await engine.dispose()
