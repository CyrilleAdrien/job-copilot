from functools import lru_cache
from typing import Annotated

import httpx
from fastapi import Depends
from redis.asyncio import Redis

from jobcopilot_common import get_settings
from jobcopilot_common.db import get_sessionmaker
from jobcopilot_common.llm import Ollama
from jobcopilot_documents.pipeline import Context
from jobcopilot_documents.settings import get_documents_settings
from jobcopilot_documents.storage import get_storage
from jobcopilot_documents.writer import DemoWriter, LLMWriter


@lru_cache
def get_cache() -> Redis:
    return Redis.from_url(get_settings().redis_url, decode_responses=True)


@lru_cache
def get_http() -> httpx.AsyncClient:
    return httpx.AsyncClient(timeout=15.0)


@lru_cache
def get_llm() -> Ollama:
    return Ollama(get_settings())


def get_context() -> Context:
    demo = get_documents_settings().llm_provider == "demo"
    return Context(
        sessions=get_sessionmaker(),
        http=get_http(),
        writer=DemoWriter() if demo else LLMWriter(get_llm()),
        storage=get_storage(),
        cache=get_cache(),
    )


Ctx = Annotated[Context, Depends(get_context)]
