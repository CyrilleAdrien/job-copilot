from functools import lru_cache
from typing import Annotated

import httpx
from fastapi import Depends
from redis.asyncio import Redis
from sqlalchemy.ext.asyncio import AsyncSession

from jobcopilot_applications.settings import get_applications_settings
from jobcopilot_common import get_settings
from jobcopilot_common.db import get_session


@lru_cache
def get_cache() -> Redis:
    return Redis.from_url(get_settings().redis_url, decode_responses=True)


@lru_cache
def get_http() -> httpx.AsyncClient:
    return httpx.AsyncClient(timeout=get_applications_settings().applications_http_timeout)


Session = Annotated[AsyncSession, Depends(get_session)]
Cache = Annotated[Redis, Depends(get_cache)]
Http = Annotated[httpx.AsyncClient, Depends(get_http)]
