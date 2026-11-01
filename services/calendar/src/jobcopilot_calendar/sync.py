"""Recopie des événements vers le calendrier CalDAV connecté. Une erreur reste sur l'événement
(et sur le compte) : l'événement est gardé dans l'app et renvoyé à la prochaine synchro."""

from datetime import UTC, datetime

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from jobcopilot_calendar import ics
from jobcopilot_calendar.crypto import SecretKeyMissing
from jobcopilot_calendar.models import AccountRow, EventRow
from jobcopilot_calendar.remote import RemoteError
from jobcopilot_calendar.settings import get_calendar_settings


async def current_account(session: AsyncSession) -> AccountRow | None:
    return await session.scalar(select(AccountRow).order_by(AccountRow.created_at).limit(1))


def single(row: EventRow) -> bytes:
    return ics.calendar([row], get_calendar_settings().reminder_minutes)


async def push(session: AsyncSession, row: EventRow, account_remote) -> None:
    account = await current_account(session)
    if account is None:
        return
    try:
        await account_remote(account).put(account.calendar_url, ics.uid(row), single(row))
    except (RemoteError, SecretKeyMissing) as exc:
        row.sync_error = account.last_error = str(exc)
        return
    row.remote_account_id = account.id
    row.synced_at = account.last_sync_at = datetime.now(UTC)
    row.sync_error = account.last_error = None


async def remove(session: AsyncSession, row: EventRow, account_remote) -> str | None:
    account = await current_account(session)
    if account is None or row.remote_account_id != account.id:
        return None
    try:
        await account_remote(account).delete(account.calendar_url, ics.uid(row))
    except (RemoteError, SecretKeyMissing) as exc:
        return str(exc)
    return None


async def push_all(session: AsyncSession, account_remote, since: datetime) -> tuple[int, list[str]]:
    rows = (await session.scalars(select(EventRow).where(EventRow.ends_at >= since))).all()
    pushed, errors = 0, []
    for row in rows:
        await push(session, row, account_remote)
        if row.sync_error:
            errors.append(f"{row.title} : {row.sync_error}")
        else:
            pushed += 1
    await session.commit()
    return pushed, errors
