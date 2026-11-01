"""Clés des sources : celles des réglages, chiffrées en base, priment sur celles de .env."""

import logging

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from jobcopilot_common.crypto import SecretKeyMissing, decrypt, encrypt
from jobcopilot_jobs.models import SearchSettingsRow, SourceCredentialRow
from jobcopilot_jobs.settings import get_jobs_settings

log = logging.getLogger(__name__)
SETTINGS_ID = 1


async def stored_names(session: AsyncSession) -> set[str]:
    return set(await session.scalars(select(SourceCredentialRow.name)))


async def load(session: AsyncSession) -> dict[str, tuple[str, str]]:
    """Une clé illisible (SECRET_KEY changée) désactive sa source sans bloquer les autres."""
    credentials = {}
    for row in await session.scalars(select(SourceCredentialRow)):
        try:
            credentials[row.name] = (decrypt(row.secret_id), decrypt(row.secret_key))
        except SecretKeyMissing:
            log.warning("clés illisibles pour la source %s", row.name)
    return credentials


async def save(session: AsyncSession, name: str, key_id: str, secret: str) -> None:
    row = await session.get(SourceCredentialRow, name)
    if row is None:
        row = SourceCredentialRow(name=name)
        session.add(row)
    row.secret_id, row.secret_key = encrypt(key_id), encrypt(secret)
    await session.commit()


async def remove(session: AsyncSession, name: str) -> None:
    await session.execute(delete(SourceCredentialRow).where(SourceCredentialRow.name == name))
    await session.commit()


async def refresh_minutes(session: AsyncSession) -> int:
    row = await session.get(SearchSettingsRow, SETTINGS_ID)
    return row.refresh_minutes if row else get_jobs_settings().jobs_refresh_ttl // 60


async def set_refresh_minutes(session: AsyncSession, minutes: int) -> None:
    row = await session.get(SearchSettingsRow, SETTINGS_ID)
    if row is None:
        session.add(SearchSettingsRow(id=SETTINGS_ID, refresh_minutes=minutes))
    else:
        row.refresh_minutes = minutes
    await session.commit()
