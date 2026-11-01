"""Service mail : lecture IMAP, rattachement et classement des réponses."""

import asyncio
import contextlib
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from sqlalchemy import select

from jobcopilot_common import create_service_app, get_settings
from jobcopilot_common.crypto import SecretKeyMissing
from jobcopilot_common.data import clear_cache, data_router
from jobcopilot_common.db import get_sessionmaker
from jobcopilot_mail.api import router
from jobcopilot_mail.deps import get_cache, get_classifier, get_http, mailbox_for
from jobcopilot_mail.mailbox import MailboxError
from jobcopilot_mail.migrate import upgrade
from jobcopilot_mail.models import AccountRow, Base
from jobcopilot_mail.settings import get_mail_settings
from jobcopilot_mail.sync import MAIL_CLASSIFIED, sync_account
from jobcopilot_mail.upstream import UpstreamError

log = logging.getLogger(__name__)


async def periodic_sync() -> None:
    """Toutes les N minutes, lit chaque boîte ; une boîte en erreur n'arrête pas les autres."""
    minutes = get_mail_settings().mail_sync_minutes
    while True:
        await asyncio.sleep(minutes * 60)
        async with get_sessionmaker()() as session:
            for account in (await session.scalars(select(AccountRow))).all():
                try:
                    await sync_account(
                        session, account, mailbox_for, get_http(), get_classifier(), get_cache()
                    )
                except (UpstreamError, MailboxError, SecretKeyMissing):
                    log.warning("lecture de %s en échec", account.email, exc_info=True)


@asynccontextmanager
async def lifespan(_app: FastAPI):
    await upgrade(get_settings().database_url)
    task = asyncio.create_task(periodic_sync()) if get_mail_settings().mail_sync_enabled else None
    yield
    if task:
        task.cancel()
        with contextlib.suppress(asyncio.CancelledError):
            await task
    await get_http().aclose()
    await get_cache().aclose()


app = create_service_app("mail", dependencies=["postgres", "redis", "ollama"], lifespan=lifespan)
app.include_router(router)


async def clear_mail_cache() -> None:
    await clear_cache(get_cache(), streams=[MAIL_CLASSIFIED])


app.include_router(data_router(Base, after_erase=clear_mail_cache))
