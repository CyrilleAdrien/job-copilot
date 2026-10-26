import asyncio

import boto3
import httpx
import pytest
from fakeredis import FakeAsyncRedis
from moto import mock_aws

from jobcopilot_common.db import get_sessionmaker
from jobcopilot_documents import pipeline
from jobcopilot_documents.deps import get_context
from jobcopilot_documents.main import app
from jobcopilot_documents.storage import Storage
from jobcopilot_documents.writer import DemoWriter


@pytest.fixture
def upstream(profile_data, offer_data):
    state = {"offer": 200}

    def handler(request: httpx.Request) -> httpx.Response:
        if request.url.path.startswith("/offers/"):
            return httpx.Response(state["offer"], json=offer_data)
        return httpx.Response(200, json=profile_data)

    state["client"] = httpx.AsyncClient(transport=httpx.MockTransport(handler))
    return state


@pytest.fixture
def storage():
    with mock_aws():
        yield Storage(boto3.client("s3", region_name="us-east-1"), "documents")


@pytest.fixture
async def client(database, upstream, storage):
    cache = FakeAsyncRedis(decode_responses=True)
    context = pipeline.Context(
        sessions=get_sessionmaker(),
        http=upstream["client"],
        writer=DemoWriter(),
        storage=storage,
        cache=cache,
    )
    app.dependency_overrides[get_context] = lambda: context
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://documents") as client:
        client.cache = cache
        yield client
    app.dependency_overrides.clear()


async def generate(client, **body) -> dict:
    response = await client.post("/generations", json={"offer_id": 7, **body})
    assert response.status_code == 202
    await asyncio.gather(*pipeline._tasks)
    return (await client.get(f"/generations/{response.json()['id']}")).json()


async def test_generation_produces_cv_and_letter(client):
    generation = await generate(client)
    assert generation["status"] == "done"
    assert generation["offer_title"] == "Ingénieur DevOps"
    assert generation["language"] == "fr"
    assert [s["state"] for s in generation["steps"]] == ["done"] * 4
    assert [d["kind"] for d in generation["documents"]] == ["cv", "letter"]
    assert generation["warnings"] == []
    events = await client.cache.xrange(pipeline.EVENTS_STREAM)
    assert events[0][1]["offer_id"] == "7"


async def test_letter_is_optional(client):
    generation = await generate(client, letter=False)
    assert [d["kind"] for d in generation["documents"]] == ["cv"]


async def test_pdf_is_served_inline(client):
    generation = await generate(client)
    cv = generation["documents"][0]
    response = await client.get(f"/documents/{cv['id']}/pdf")
    assert response.status_code == 200
    assert response.content.startswith(b"%PDF")
    assert response.headers["content-type"] == "application/pdf"
    assert 'filename="CV Alex Martin.pdf"' in response.headers["content-disposition"]


async def test_pages_are_previewed_as_png(client):
    generation = await generate(client)
    cv = generation["documents"][0]
    assert cv["pages"] == 1
    response = await client.get(f"/documents/{cv['id']}/pages/1")
    assert response.headers["content-type"] == "image/png"
    assert response.content.startswith(b"\x89PNG")
    assert (await client.get(f"/documents/{cv['id']}/pages/2")).status_code == 404


async def test_edit_creates_a_new_version(client):
    generation = await generate(client)
    letter_id = generation["documents"][1]["id"]
    content = (await client.get(f"/documents/{letter_id}")).json()["content"]
    content["paragraphs"] = ["Paragraphe revu."]
    response = await client.put(f"/documents/{letter_id}/content", json=content)
    assert response.status_code == 200
    assert response.json()["version"] == 2
    assert response.json()["content"]["paragraphs"] == ["Paragraphe revu."]
    assert (await client.get(f"/documents/{letter_id}/pdf")).content.startswith(b"%PDF")


async def test_invalid_edit_is_rejected(client):
    generation = await generate(client)
    letter_id = generation["documents"][1]["id"]
    response = await client.put(f"/documents/{letter_id}/content", json={"paragraphs": []})
    assert response.status_code == 422


async def test_missing_offer_ends_in_error(client, upstream):
    upstream["offer"] = 404
    generation = await generate(client)
    assert generation["status"] == "error"
    assert generation["error"] == "Offre introuvable."
    assert generation["steps"][0]["state"] == "error"
    assert generation["documents"] == []


async def test_events_stream_ends_with_done(client):
    generation = await generate(client)
    response = await client.get(f"/generations/{generation['id']}/events")
    assert response.headers["content-type"].startswith("text/event-stream")
    assert response.text.startswith("event: done\ndata: ")


async def test_generations_are_listed_by_offer(client):
    await generate(client)
    assert len((await client.get("/generations", params={"offer_id": 7})).json()) == 1
    assert (await client.get("/generations", params={"offer_id": 8})).json() == []


async def test_unknown_generation(client):
    response = await client.get("/generations/00000000-0000-0000-0000-000000000000")
    assert response.status_code == 404
