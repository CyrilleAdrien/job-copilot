import asyncio
import uuid

import httpx
import pytest

from jobcopilot_applications import events
from jobcopilot_applications.deps import get_cache, get_http
from jobcopilot_applications.main import app
from jobcopilot_applications.upstream import contact_email
from jobcopilot_common.db import get_sessionmaker

CV_ID, LETTER_ID, OLD_CV_ID = uuid.uuid4(), uuid.uuid4(), uuid.uuid4()
OFFER = {
    "id": 7,
    "source": "adzuna",
    "title": "Ingénieur DevOps",
    "company": "Nimbus",
    "location": "Paris",
    "url": "https://example.org/7",
    "description": "Envoyez votre CV à jobs@nimbus.example, pas à noreply@nimbus.example.",
}


def upstream(request: httpx.Request) -> httpx.Response:
    if request.url.path == "/offers/7":
        return httpx.Response(200, json=OFFER)
    if request.url.path.startswith("/offers/"):
        return httpx.Response(404, json={"detail": "Offre introuvable."})
    if request.url.path == "/generations":
        if request.url.params["offer_id"] != "7":
            return httpx.Response(200, json=[])
        return httpx.Response(
            200,
            json=[
                {"status": "running", "documents": []},
                {
                    "status": "done",
                    "documents": [
                        {"id": str(OLD_CV_ID), "kind": "cv", "version": 1},
                        {"id": str(CV_ID), "kind": "cv", "version": 2},
                        {"id": str(LETTER_ID), "kind": "letter", "version": 1},
                    ],
                },
            ],
        )
    return httpx.Response(500)


@pytest.fixture
async def client(database, cache):
    app.dependency_overrides[get_cache] = lambda: cache
    app.dependency_overrides[get_http] = lambda: httpx.AsyncClient(
        transport=httpx.MockTransport(upstream)
    )
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://applications") as client:
        yield client
    app.dependency_overrides.clear()


async def test_application_from_an_offer_takes_its_details_and_documents(client, cache):
    response = await client.post("/applications", json={"offer_id": 7, "search": "devops"})
    assert response.status_code == 201
    body = response.json()
    assert body["title"] == "Ingénieur DevOps"
    assert body["company"] == "Nimbus"
    assert body["status"] == "draft"
    assert body["contact_email"] == "jobs@nimbus.example"
    assert body["cv_document_id"] == str(CV_ID)
    assert body["letter_document_id"] == str(LETTER_ID)
    assert [event["to_status"] for event in body["events"]] == ["draft"]
    [(_, fields)] = await cache.xrange(events.APPLICATION_CREATED)
    assert fields["offer_id"] == "7"
    # Une offre n'a qu'une candidature.
    again = await client.post("/applications", json={"offer_id": 7})
    assert again.status_code == 200
    assert again.json()["id"] == body["id"]


async def test_unknown_offer(client):
    response = await client.post("/applications", json={"offer_id": 99})
    assert response.status_code == 404


async def test_manual_application_needs_a_title(client):
    assert (await client.post("/applications", json={"company": "Nimbus"})).status_code == 422
    response = await client.post(
        "/applications", json={"title": "SRE", "company": "Brume", "status": "sent"}
    )
    body = response.json()
    assert body["source"] == "manuel"
    assert body["status"] == "sent"
    assert body["applied_at"] is not None


async def test_status_changes_are_kept_in_history(client, cache):
    created = (await client.post("/applications", json={"offer_id": 7})).json()
    url = f"/applications/{created['id']}"
    sent = (await client.patch(url, json={"status": "sent"})).json()
    assert sent["applied_at"] is not None
    updated = (
        await client.patch(
            url, json={"status": "interview", "status_source": "mail", "notes": "Appel mardi"}
        )
    ).json()
    assert updated["notes"] == "Appel mardi"
    assert [(e["from_status"], e["to_status"], e["source"]) for e in updated["events"]] == [
        (None, "draft", "manual"),
        ("draft", "sent", "manual"),
        ("sent", "interview", "mail"),
    ]
    # Même statut : rien n'est ajouté.
    same = (await client.patch(url, json={"status": "interview"})).json()
    assert len(same["events"]) == 3
    assert len(await cache.xrange(events.STATUS_CHANGED)) == 2


async def test_list_filters_and_delete(client):
    first = (await client.post("/applications", json={"offer_id": 7})).json()
    await client.post("/applications", json={"title": "SRE", "status": "sent"})
    assert len((await client.get("/applications")).json()) == 2
    assert [a["id"] for a in (await client.get("/applications?offer_id=7")).json()] == [first["id"]]
    assert len((await client.get("/applications?status=sent")).json()) == 1
    assert (await client.delete(f"/applications/{first['id']}")).status_code == 204
    assert (await client.get(f"/applications/{first['id']}")).status_code == 404


async def test_generated_documents_are_attached(client):
    created = (await client.post("/applications", json={"title": "SRE"})).json()
    from_offer = (await client.post("/applications", json={"offer_id": 7})).json()
    new_cv = uuid.uuid4()
    async with get_sessionmaker()() as session:
        assert await events.attach_documents(session, {"offer_id": "7", "cv_id": str(new_cv)})
        assert not await events.attach_documents(session, {"offer_id": "8", "cv_id": str(new_cv)})
    body = (await client.get(f"/applications/{from_offer['id']}")).json()
    assert body["cv_document_id"] == str(new_cv)
    assert body["letter_document_id"] == str(LETTER_ID)
    assert (await client.get(f"/applications/{created['id']}")).json()["cv_document_id"] is None


def test_contact_email_skips_no_reply_addresses():
    assert contact_email("Écrire à no-reply@a.fr ou rh@b.fr.") == "rh@b.fr"
    assert contact_email("Postulez sur notre site.") is None


class OneBatch:
    """Bus minimal : renvoie un lot de messages, puis arrête la boucle de lecture."""

    def __init__(self, fields: dict[str, str]):
        self.batches = [[(events.DOCUMENT_GENERATED, [("1-0", fields)])]]
        self.acked: list[str] = []

    async def xgroup_create(self, *args, **kwargs):
        return True

    async def xreadgroup(self, *args, **kwargs):
        if not self.batches:
            raise asyncio.CancelledError
        return self.batches.pop()

    async def xack(self, stream, group, message_id):
        self.acked.append(message_id)


async def test_consumer_reads_document_generated(client):
    created = (await client.post("/applications", json={"offer_id": 7})).json()
    new_letter = uuid.uuid4()
    bus = OneBatch({"offer_id": "7", "letter_id": str(new_letter)})
    with pytest.raises(asyncio.CancelledError):
        await events.consume(bus, get_sessionmaker())
    assert bus.acked == ["1-0"]
    body = (await client.get(f"/applications/{created['id']}")).json()
    assert body["letter_document_id"] == str(new_letter)
