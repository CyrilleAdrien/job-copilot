from functools import lru_cache
from typing import Annotated

import httpx
from fastapi import Depends
from redis.asyncio import Redis
from sqlalchemy.ext.asyncio import AsyncSession

from jobcopilot_calendar.models import AccountRow
from jobcopilot_calendar.remote import CaldavRemote, DemoRemote, Remote
from jobcopilot_calendar.settings import get_calendar_settings
from jobcopilot_common import get_settings
from jobcopilot_common.crypto import decrypt
from jobcopilot_common.db import get_session
from jobcopilot_common.mode import is_demo

DEMO_URL = "demo"


@lru_cache
def get_http() -> httpx.AsyncClient:
    return httpx.AsyncClient(timeout=get_calendar_settings().calendar_http_timeout)


@lru_cache
def demo_remote() -> DemoRemote:
    return DemoRemote()


@lru_cache
def get_cache() -> Redis:
    return Redis.from_url(get_settings().redis_url, decode_responses=True)


async def demo_calendar() -> bool:
    """Calendrier de démonstration permis : par .env ou par le mode choisi dans l'assistant."""
    return await is_demo(get_cache(), get_calendar_settings().calendar_demo)


def remote_for(url: str, username: str, password: str) -> Remote:
    # Un compte « demo » n'a pu être créé qu'en démonstration (voir discover).
    if url == DEMO_URL:
        return demo_remote()
    return CaldavRemote(url, username, password, get_calendar_settings().caldav_timeout)


def account_remote(account: AccountRow) -> Remote:
    return remote_for(account.url, account.username, decrypt(account.password_encrypted))


def get_remote_factory():
    return remote_for


def get_account_remote():
    return account_remote


Session = Annotated[AsyncSession, Depends(get_session)]
Http = Annotated[httpx.AsyncClient, Depends(get_http)]
RemoteFactory = Annotated[object, Depends(get_remote_factory)]
AccountRemote = Annotated[object, Depends(get_account_remote)]
