import json

import httpx
import pytest

from jobcopilot_mail import api as mail_api
from jobcopilot_mail.classify import Classification
from jobcopilot_mail.deps import get_cache, get_classifier, get_http, get_sender_factory
from jobcopilot_mail.mailbox import MailboxError
from jobcopilot_mail.main import app
from jobcopilot_mail.outbox import SendError
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


async def test_each_real_provider_explains_how_to_create_an_app_password(client):
    providers = {p["id"]: p for p in (await client.get("/providers")).json()}
    assert "https://myaccount.google.com/apppasswords" in [
        link["url"] for link in providers["gmail"]["links"]
    ]
    for provider_id in ("gmail", "icloud", "outlook", "other"):
        assert providers[provider_id]["steps"]
    for provider in providers.values():
        assert all(link["url"].startswith("https://") for link in provider["links"])


class Outbox:
    """Faux envoi : retient les mails, ou échoue si on lui donne une erreur."""

    def __init__(self, error: Exception | None = None):
        self.sent, self.error = [], error

    def send(self, message):
        if self.error:
            raise self.error
        self.sent.append(message)


@pytest.fixture
def outbox():
    box = Outbox()
    app.dependency_overrides[get_sender_factory] = lambda: lambda account: box
    return box


async def synced_messages(client) -> dict[str, dict]:
    await demo_account(client)
    await client.post("/sync")
    return {m["category"]: m for m in (await client.get("/messages")).json()}


def reply_to(address="rh@nimbus.example", subject="Re: Entretien", body="Bonjour, mardi 14 h."):
    return {"to": address, "subject": subject, "body": body}


async def test_reply_is_sent_recorded_and_threaded(client, upstream, outbox):
    message = (await synced_messages(client))["interview"]
    patches = len(upstream.patches)
    response = await client.post(f"/messages/{message['id']}/reply", json=reply_to())
    assert response.status_code == 201
    assert [r["body"] for r in response.json()["replies"]] == ["Bonjour, mardi 14 h."]
    sent = outbox.sent[0]
    assert sent["From"] == "moi@demo"
    assert sent["To"] == "rh@nimbus.example"
    assert sent["In-Reply-To"].startswith("<demo-")
    # La fiche lit la réponse avec le mail ; le statut de la candidature ne bouge pas.
    linked = await client.get("/messages", params={"application_id": message["application_id"]})
    assert linked.json()[0]["replies"][0]["to_address"] == "rh@nimbus.example"
    assert len(upstream.patches) == patches
    # Une seconde réponse s'ajoute à la première, une relecture n'y touche pas.
    await client.post(f"/messages/{message['id']}/reply", json=reply_to(body="Ou mercredi."))
    await client.post("/sync")
    bodies = [
        r["body"]
        for m in (await client.get("/messages")).json()
        if m["id"] == message["id"]
        for r in m["replies"]
    ]
    assert bodies == ["Bonjour, mardi 14 h.", "Ou mercredi."]


async def test_reply_keeps_a_mail_that_still_needs_a_decision(client, outbox):
    # Sans candidature : le mail reste à rattacher, donc à vérifier.
    loose = (await synced_messages(client))["acknowledgment"]
    response = await client.post(f"/messages/{loose['id']}/reply", json=reply_to())
    assert response.json()["reviewed"] is False


async def test_reply_treats_a_linked_mail_without_pending_status(client, outbox):
    loose = (await synced_messages(client))["acknowledgment"]
    await client.patch(f"/messages/{loose['id']}", json={"application_id": APPLICATIONS[3]["id"]})
    response = await client.post(f"/messages/{loose['id']}/reply", json=reply_to())
    assert response.json()["reviewed"] is True


@pytest.mark.parametrize(
    "payload",
    [
        reply_to(body="   \n "),
        reply_to(address="pas-une-adresse"),
        reply_to(address="a@b.fr, c@d.fr"),
        reply_to(address="a@b.fr\nBcc: c@d.fr"),
        reply_to(subject=""),
        reply_to(subject="Bonjour\nBcc: c@d.fr"),
    ],
)
async def test_invalid_reply_sends_nothing(client, outbox, payload):
    message = (await synced_messages(client))["interview"]
    response = await client.post(f"/messages/{message['id']}/reply", json=payload)
    assert response.status_code == 422
    assert outbox.sent == []


async def test_failed_send_is_reported_and_not_recorded(client):
    message = (await synced_messages(client))["interview"]
    box = Outbox(SendError("Serveur d'envoi injoignable."))
    app.dependency_overrides[get_sender_factory] = lambda: lambda account: box
    response = await client.post(f"/messages/{message['id']}/reply", json=reply_to())
    assert response.status_code == 502
    assert "injoignable" in response.json()["detail"]
    assert all(m["replies"] == [] for m in (await client.get("/messages")).json())


async def test_reply_to_unknown_mail(client, outbox):
    response = await client.post(
        "/messages/00000000-0000-0000-0000-000000000000/reply", json=reply_to()
    )
    assert response.status_code == 404


async def test_disconnecting_the_mailbox_removes_its_replies(client, outbox):
    message = (await synced_messages(client))["interview"]
    await client.post(f"/messages/{message['id']}/reply", json=reply_to())
    account = (await client.get("/accounts")).json()[0]
    assert (await client.delete(f"/accounts/{account['id']}")).status_code == 204
    assert (await client.get("/messages")).json() == []


async def test_demo_mailbox_sends_nothing_over_the_network(client, monkeypatch):
    # Sans faux envoi : la vraie fabrique doit choisir DemoSender, sans ouvrir de connexion.
    def refuse(*args, **kwargs):
        raise AssertionError("connexion SMTP ouverte par une boîte de démonstration")

    monkeypatch.setattr("smtplib.SMTP", refuse)
    monkeypatch.setattr("smtplib.SMTP_SSL", refuse)
    message = (await synced_messages(client))["interview"]
    response = await client.post(f"/messages/{message['id']}/reply", json=reply_to())
    assert response.status_code == 201


async def test_export_leaves_passwords_out_and_erase_removes_everything(client, cache, monkeypatch):
    monkeypatch.setattr(mail_api.ImapMailbox, "check", lambda self: None)
    monkeypatch.setattr("jobcopilot_mail.main.get_cache", lambda: cache)
    payload = {"email": "moi@gmail.com", "host": "imap.gmail.com", "password": "abcd efgh"}
    assert (await client.post("/accounts", json=payload)).status_code == 201
    await cache.xadd(MAIL_CLASSIFIED, {"subject": "Entretien"})

    export = await client.get("/data/export")
    assert export.status_code == 200
    assert export.json()["accounts"][0]["email"] == "moi@gmail.com"
    assert "password" not in export.text
    assert "gAAAA" not in export.text  # préfixe de tout jeton Fernet
    assert set(export.json()) == {"accounts", "messages", "replies"}

    assert (await client.delete("/data")).status_code == 204
    assert (await client.get("/accounts")).json() == []
    assert await cache.xlen(MAIL_CLASSIFIED) == 0
    assert (await client.delete("/data")).status_code == 204
