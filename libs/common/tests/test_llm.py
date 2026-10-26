import json

import httpx
import pytest
from pydantic import BaseModel

from jobcopilot_common import Settings
from jobcopilot_common.llm import LLMError, Ollama


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


async def test_invalid_json_is_retried_once():
    answers = iter([chat('{"value": '), chat('{"value": 1}')])
    assert await ollama(lambda _: next(answers)).complete("s", "q", Answer) == Answer(value=1)


async def test_invalid_json_twice_raises():
    with pytest.raises(LLMError, match="format"):
        await ollama(lambda _: chat("pas du JSON")).complete("s", "q", Answer)


async def test_missing_model_is_explained():
    with pytest.raises(LLMError, match="make models"):
        await ollama(lambda _: httpx.Response(404)).complete("s", "q", Answer)


async def test_unreachable_ollama():
    def refuse(request):
        raise httpx.ConnectError("refused", request=request)

    with pytest.raises(LLMError, match="injoignable"):
        await ollama(refuse).complete("s", "q", Answer)


async def test_available_checks_the_model_is_pulled():
    tags = {"models": [{"name": "qwen2.5:7b"}]}
    assert await ollama(lambda _: httpx.Response(200, json=tags)).available()
    assert not await ollama(lambda _: httpx.Response(200, json={"models": []})).available()
