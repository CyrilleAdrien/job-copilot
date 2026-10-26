import asyncio
from pathlib import Path

from alembic import command
from alembic.config import Config

MIGRATIONS = Path(__file__).parent / "migrations"


def alembic_config(database_url: str) -> Config:
    config = Config()
    config.set_main_option("script_location", str(MIGRATIONS))
    config.set_main_option("sqlalchemy.url", database_url)
    return config


async def upgrade(database_url: str) -> None:
    """Applique les migrations dans un thread : Alembic lance sa propre boucle asyncio."""
    await asyncio.to_thread(command.upgrade, alembic_config(database_url), "head")
