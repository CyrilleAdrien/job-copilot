from functools import lru_cache
from typing import Annotated

import httpx
from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession

from jobcopilot_calendar.crypto import decrypt
from jobcopilot_calendar.models import AccountRow
from jobcopilot_calendar.remote import CaldavRemote, DemoRemote, Remote
from jobcopilot_calendar.settings import get_calendar_settings
from jobcopilot_common.db import get_session

DEMO_URL = "demo"


@lru_cache
def get_http() -> httpx.AsyncClient:
    return httpx.AsyncClient(timeout=get_calendar_settings().calendar_http_timeout)


@lru_cache
def demo_remote() -> DemoRemote:
    return DemoRemote()


def remote_for(url: str, username: str, password: str) -> Remote:
    if url == DEMO_URL and get_calendar_settings().calendar_demo:
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
