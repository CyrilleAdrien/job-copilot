import json

import httpx
import pytest
from fakeredis import FakeAsyncRedis
from pydantic import BaseModel
from redis.exceptions import RedisError

from jobcopilot_common import Settings
from jobcopilot_common.llm import MODEL_KEY, LLMError, Ollama


class Answer(BaseModel):
    value: int


def ollama(handler) -> Ollama:
    client = httpx.AsyncClient(transport=httpx.MockTransport(handler))
    return Ollama(Settings(ollama_url="http://ollama", ollama_model="qwen2.5:7b"), client)


def chat(content: str) -> httpx.Response:
    return httpx.Response(200, json={"message": {"role": "assistant", "content": content}})


async def test_complete_sends_schema_and_parses_answer():
    seen = []

    def handler(request: httpx.Request) -> httpx.Response:
        seen.append(json.loads(request.content))
        return chat('{"value": 42}')

    assert await ollama(handler).complete("système", "question", Answer) == Answer(value=42)
    body = seen[0]
    assert body["model"] == "qwen2.5:7b"
    assert body["format"]["properties"]["value"]["type"] == "integer"
    assert body["messages"][0] == {"role": "system", "content": "système"}
    assert body["stream"] is False
    assert body["options"]["num_ctx"] == 8192


async def test_invalid_json_is_retried_once():
    answers = iter([chat('{"value": '), chat('{"value": 1}')])
    assert await ollama(lambda _: next(answers)).complete("s", "q", Answer) == Answer(value=1)


async def test_invalid_json_twice_raises():
    with pytest.raises(LLMError, match="format"):
        await ollama(lambda _: chat("pas du JSON")).complete("s", "q", Answer)


async def test_missing_model_is_explained():
    with pytest.raises(LLMError, match="make models"):
        await ollama(lambda _: httpx.Response(404)).complete("s", "q", Answer)


async def test_slow_model_reports_the_timeout():
    def slow(request):
        raise httpx.ReadTimeout("timeout", request=request)

    with pytest.raises(LLMError, match="LLM_TIMEOUT"):
        await ollama(slow).complete("s", "q", Answer)


async def test_crash_mentions_memory():
    def crash(request):
        raise httpx.RemoteProtocolError("closed", request=request)

    with pytest.raises(LLMError, match="mémoire"):
        await ollama(crash).complete("s", "q", Answer)


async def test_unreachable_ollama():
    def refuse(request):
        raise httpx.ConnectError("refused", request=request)

    with pytest.raises(LLMError, match="injoignable"):
        await ollama(refuse).complete("s", "q", Answer)


async def test_available_checks_the_model_is_pulled():
    tags = {"models": [{"name": "qwen2.5:7b"}]}
    assert await ollama(lambda _: httpx.Response(200, json=tags)).available()
    assert not await ollama(lambda _: httpx.Response(200, json={"models": []})).available()


async def test_model_chosen_in_settings_replaces_the_default():
    cache = FakeAsyncRedis(decode_responses=True)
    seen = []

    def chat(request):
        seen.append(json.loads(request.content)["model"])
        return httpx.Response(200, json={"message": {"content": '{"ok": true}'}})

    class Ok(BaseModel):
        ok: bool

    async with httpx.AsyncClient(transport=httpx.MockTransport(chat)) as client:
        llm = Ollama(Settings(ollama_model="defaut:7b"), client, cache)
        await llm.complete("s", "p", Ok)
        await cache.set(MODEL_KEY, "choisi:4b")
        await llm.complete("s", "p", Ok)
    assert seen == ["defaut:7b", "choisi:4b"]


async def test_unavailable_redis_falls_back_on_the_default():
    class Down:
        async def get(self, key):
            raise RedisError("down")

    llm = Ollama(Settings(ollama_model="defaut:7b"), httpx.AsyncClient(), Down())
    assert await llm.current_model() == "defaut:7b"
