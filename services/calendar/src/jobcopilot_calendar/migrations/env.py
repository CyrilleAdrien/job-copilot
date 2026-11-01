import asyncio

from alembic import context
from sqlalchemy import text
from sqlalchemy.engine import Connection
from sqlalchemy.ext.asyncio import create_async_engine

from jobcopilot_calendar.models import SCHEMA, Base
from jobcopilot_common.db import async_url


def run(connection: Connection) -> None:
    connection.execute(text(f'CREATE SCHEMA IF NOT EXISTS "{SCHEMA}"'))
    context.configure(
        connection=connection,
        target_metadata=Base.metadata,
        version_table_schema=SCHEMA,
        include_schemas=True,
    )
    with context.begin_transaction():
        context.run_migrations()


async def main() -> None:
    engine = create_async_engine(async_url(context.config.get_main_option("sqlalchemy.url")))
    async with engine.begin() as connection:
        await connection.run_sync(run)
    await engine.dispose()


asyncio.run(main())
