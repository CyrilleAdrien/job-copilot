import json

import httpx
import pytest

from jobcopilot_mail import api as mail_api
from jobcopilot_mail.classify import Classification
from jobcopilot_mail.deps import get_cache, get_classifier, get_http
from jobcopilot_mail.mailbox import MailboxError
from jobcopilot_mail.main import app
from jobcopilot_mail.sync import MAIL_CLASSIFIED


def application(number: int, title: str, company: str, status: str, **extra) -> dict:
    applied = None if status == "draft" else f"2026-10-{10 + number}T10:00:00Z"
    return {
        "id": f"{number}" * 8 + "-1111-1111-1111-111111111111",
        "title": title,
        "company": company,
        "contact_email": extra.get("contact_email"),
        "status": status,
        "applied_at": applied,
    }


APPLICATIONS = [
    application(1, "Ingénieur DevOps", "Nimbus Data", "sent", contact_email="jobs@nimbus.example"),
    application(2, "SRE", "Atelier Numérique", "followed_up"),
    application(3, "Platform Engineer", "Quartz", "sent"),
    application(4, "Data Engineer", "Cobalt", "draft"),
]


class Upstream:
    """Faux service applications : liste les candidatures, enregistre les changements."""

    def __init__(self):
        self.patches: list[tuple[str, dict]] = []

    def __call__(self, request: httpx.Request) -> httpx.Response:
        if request.method == "GET" and request.url.path == "/applications":
            return httpx.Response(200, json=APPLICATIONS)
        if request.method == "PATCH":
            self.patches.append((request.url.path.rsplit("/", 1)[-1], json.loads(request.content)))
            return httpx.Response(200, json={})
        return httpx.Response(404)


@pytest.fixture
def upstream():
    return Upstream()


@pytest.fixture
async def client(database, cache, upstream):
    app.dependency_overrides[get_cache] = lambda: cache
    app.dependency_overrides[get_http] = lambda: httpx.AsyncClient(
        transport=httpx.MockTransport(upstream)
    )
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://mail") as client:
        yield client
    app.dependency_overrides.clear()


async def demo_account(client) -> dict:
    response = await client.post("/accounts", json={"email": "moi@demo", "host": "demo"})
    assert response.status_code == 201
    return response.json()


async def test_sync_links_classifies_and_updates_statuses(client, upstream, cache):
    await demo_account(client)
    report = (await client.post("/sync")).json()
    # 3 réponses aux candidatures envoyées + 1 mail de recrutement à rattacher ; la lettre
    # d'information n'est pas gardée.
    assert report == {"accounts": 1, "new": 4, "linked": 3, "applied": 3, "errors": []}
    assert sorted(upstream.patches) == sorted(
        [
            (APPLICATIONS[0]["id"], {"status": "rejected", "status_source": "mail"}),
            (APPLICATIONS[1]["id"], {"status": "interview", "status_source": "mail"}),
            (APPLICATIONS[2]["id"], {"status": "technical_test", "status_source": "mail"}),
        ]
    )
    messages = (await client.get("/messages")).json()
    assert len(messages) == 4
    assert all("Lettre" not in m["subject"] for m in messages)
    assert {m["category"] for m in messages} == {
        "rejection",
        "interview",
        "technical_test",
        "acknowledgment",
    }
    pending = (await client.get("/messages", params={"review": "pending"})).json()
    assert [m["subject"] for m in pending] == ["Votre candidature a bien été reçue"]
    assert len(await cache.xrange(MAIL_CLASSIFIED)) == 4
    # Une seconde lecture ne reprend rien.
    again = (await client.post("/sync")).json()
    assert (again["new"], again["applied"]) == (0, 0)
    accounts = (await client.get("/accounts")).json()
    assert accounts[0]["messages"] == 4 and accounts[0]["last_error"] is None
    assert "password" not in json.dumps(accounts)


async def test_low_confidence_is_suggested_but_not_applied(client, upstream):
    class Unsure:
        async def classify(self, *args):
            return Classification(category="interview", confidence=0.5, reason="ambigu")

    app.dependency_overrides[get_classifier] = lambda: Unsure()
    await demo_account(client)
    report = (await client.post("/sync")).json()
    assert report["applied"] == 0 and upstream.patches == []
    message = next(m for m in (await client.get("/messages")).json() if m["application_id"])
    assert message["suggested_status"] == "interview" and not message["status_applied"]
    applied = (await client.post(f"/messages/{message['id']}/apply")).json()
    assert applied["status_applied"] and applied["reviewed"]
    assert upstream.patches == [
        (message["application_id"], {"status": "interview", "status_source": "mail"})
    ]


async def test_unlinked_mail_can_be_linked_and_recategorised_by_hand(client, upstream):
    await demo_account(client)
    await client.post("/sync")
    upstream.patches.clear()
    unlinked = (await client.get("/messages", params={"review": "pending"})).json()[0]
    assert unlinked["application_id"] is None
    assert (await client.post(f"/messages/{unlinked['id']}/apply")).status_code == 409
    target = APPLICATIONS[2]["id"]
    updated = (
        await client.patch(
            f"/messages/{unlinked['id']}", json={"application_id": target, "category": "interview"}
        )
    ).json()
    assert updated["application_id"] == target
    assert updated["suggested_status"] == "interview"
    assert updated["match_reason"] == "rattaché à la main"
    await client.post(f"/messages/{unlinked['id']}/apply")
    assert upstream.patches == [(target, {"status": "interview", "status_source": "mail"})]
    by_app = (await client.get("/messages", params={"application_id": target})).json()
    assert len(by_app) == 2


async def test_account_checks_connection_and_never_stores_a_plain_password(client, monkeypatch):
    payload = {
        "email": "moi@gmail.com",
        "host": "imap.gmail.com",
        "password": "abcd efgh ijkl mnop",
    }
    assert (await client.post("/accounts", json={**payload, "password": ""})).status_code == 422

    def refuse(self):
        raise MailboxError("Identifiants refusés.")

    monkeypatch.setattr(mail_api.ImapMailbox, "check", refuse)
    response = await client.post("/accounts", json=payload)
    assert response.status_code == 400 and "refusés" in response.json()["detail"]

    monkeypatch.setattr(mail_api.ImapMailbox, "check", lambda self: None)
    created = (await client.post("/accounts", json=payload)).json()
    assert created["username"] == "moi@gmail.com"
    assert "password" not in created
    from jobcopilot_common.db import get_sessionmaker
    from jobcopilot_mail.models import AccountRow

    async with get_sessionmaker()() as session:
        row = await session.get(AccountRow, created["id"])
        assert "abcd" not in row.password_encrypted
    assert (await client.delete(f"/accounts/{created['id']}")).status_code == 204
    assert (await client.get("/accounts")).json() == []


async def test_providers_include_demo_only_in_demo_mode(client):
    ids = [p["id"] for p in (await client.get("/providers")).json()]
    assert ids == ["gmail", "icloud", "outlook", "other", "demo"]
