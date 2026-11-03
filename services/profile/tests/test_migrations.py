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


async def test_cv_moves_into_each_search_and_back():
    engine = create_async_engine(async_url(TEST_DATABASE_URL))
    async with engine.begin() as connection:
        await connection.execute(text('DROP SCHEMA IF EXISTS "profile" CASCADE'))
    await run("0004")
    searches = '[{"id": "a", "roles": ["X"]}, {"id": "b", "roles": ["Y"]}]'
    async with engine.begin() as connection:
        await connection.execute(
            text(
                "INSERT INTO profile.profiles (id, full_name, headline, summary, searches, skills,"
                " languages) VALUES (1, 'A', 'Titre', 'Résumé', CAST(:searches AS jsonb),"
                ' \'[{"name": "S", "items": ["T"]}]\', \'[{"name": "Fr", "level": "N"}]\')'
            ),
            {"searches": searches},
        )
        await connection.execute(
            text(
                "INSERT INTO profile.experiences (profile_id, position, title, company, start,"
                " groups, technologies) VALUES (1, 0, 'Poste', 'Acme', '2024-01', '[]', '[\"P\"]')"
            )
        )

    await engine.dispose()
    await run("head")
    async with engine.connect() as connection:
        row = (await connection.execute(text("SELECT * FROM profile.profiles"))).mappings().one()
        tables = await connection.execute(
            text("SELECT tablename FROM pg_tables WHERE schemaname = 'profile'")
        )
        names = {item[0] for item in tables}
    assert "experiences" not in names
    assert "headline" not in row
    assert row["languages"] == [{"name": "Fr", "level": "N"}]
    first, second = row["searches"]
    assert first["cv"] == second["cv"]
    assert first["cv"]["headline"] == "Titre"
    assert first["cv"]["summary"] == "Résumé"
    assert first["cv"]["skills"] == [{"name": "S", "items": ["T"]}]
    assert first["cv"]["experiences"][0]["company"] == "Acme"
    assert first["id"] == "a"

    await engine.dispose()
    await run("0004", down=True)
    async with engine.connect() as connection:
        row = (await connection.execute(text("SELECT * FROM profile.profiles"))).mappings().one()
        experience = (
            (await connection.execute(text("SELECT * FROM profile.experiences"))).mappings().one()
        )
    assert row["headline"] == "Titre"
    assert row["skills"] == [{"name": "S", "items": ["T"]}]
    assert "cv" not in row["searches"][0]
    assert experience["company"] == "Acme"
    assert experience["technologies"] == ["P"]
    await run("head")
    await engine.dispose()
