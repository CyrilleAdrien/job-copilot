import json
from datetime import UTC, datetime, timedelta

import httpx
import pytest
from icalendar import Calendar

from jobcopilot_calendar.deps import demo_remote, get_http
from jobcopilot_calendar.main import app
from jobcopilot_calendar.remote import DemoRemote

APP_ID = "11111111-1111-1111-1111-111111111111"
START = datetime.now(UTC).replace(microsecond=0) + timedelta(days=3)


class Upstream:
    """Faux service applications : une candidature, et les changements de statut reçus."""

    def __init__(self, status: str = "sent"):
        self.status = status
        self.patches: list[dict] = []

    def __call__(self, request: httpx.Request) -> httpx.Response:
        if request.url.path == f"/applications/{APP_ID}":
            if request.method == "PATCH":
                self.patches.append(json.loads(request.content))
                return httpx.Response(200, json={})
            return httpx.Response(200, json={"id": APP_ID, "title": "SRE", "status": self.status})
        return httpx.Response(404)


@pytest.fixture
def upstream():
    return Upstream()


@pytest.fixture
def remote():
    remote = demo_remote()
    remote.events.clear()
    remote.fail = False
    return remote


@pytest.fixture
async def client(database, upstream, remote):
    app.dependency_overrides[get_http] = lambda: httpx.AsyncClient(
        transport=httpx.MockTransport(upstream)
    )
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://calendar") as client:
        yield client
    app.dependency_overrides.clear()


def event(**overrides) -> dict:
    body = {
        "kind": "interview",
        "title": "Entretien SRE",
        "starts_at": START.isoformat(),
        "ends_at": (START + timedelta(hours=1)).isoformat(),
        "location": "Paris",
        "video_url": "https://meet.example/abc",
        "notes": "Préparer le cas Kubernetes",
    }
    return body | overrides


async def connect(client) -> dict:
    calendars = (
        await client.post(
            "/accounts/discover",
            json={"provider": "demo", "url": "demo", "username": "moi", "password": "x"},
        )
    ).json()
    assert [c["name"] for c in calendars] == ["Travail", "Personnel"]
    response = await client.post(
        "/accounts",
        json={
            "provider": "demo",
            "url": "demo",
            "username": "moi",
            "password": "x",
            "calendar_url": calendars[0]["url"],
            "calendar_name": calendars[0]["name"],
        },
    )
    assert response.status_code == 201
    return response.json()


async def test_interview_moves_the_application_forward_once(client, upstream):
    response = await client.post("/events", json=event(application_id=APP_ID))
    assert response.status_code == 201
    assert response.json()["status_changed"] is True
    assert upstream.patches == [{"status": "interview", "status_source": "manual"}]
    # Déjà en entretien : un test technique planifié ensuite ne la fait pas reculer.
    upstream.status = "interview"
    second = await client.post("/events", json=event(kind="technical_test", application_id=APP_ID))
    assert second.json()["status_changed"] is False
    assert len(upstream.patches) == 1
    listed = (await client.get("/events", params={"application_id": APP_ID})).json()
    assert len(listed) == 2


async def test_status_left_alone_when_asked(client, upstream):
    body = event(application_id=APP_ID, advance_status=False)
    assert (await client.post("/events", json=body)).json()["status_changed"] is False
    assert upstream.patches == []


async def test_validation(client):
    late = event(ends_at=(START - timedelta(hours=1)).isoformat())
    assert (await client.post("/events", json=late)).status_code == 422
    naive = event(starts_at="2026-11-10T10:00:00", ends_at="2026-11-10T11:00:00")
    assert (await client.post("/events", json=naive)).status_code == 422
    unknown = event(application_id="22222222-2222-2222-2222-222222222222")
    assert (await client.post("/events", json=unknown)).status_code == 404


async def test_range_filter(client):
    await client.post("/events", json=event())
    past = START - timedelta(days=30)
    await client.post(
        "/events",
        json=event(
            title="Ancien",
            starts_at=past.isoformat(),
            ends_at=(past + timedelta(hours=1)).isoformat(),
        ),
    )
    upcoming = (await client.get("/events", params={"from": datetime.now(UTC).isoformat()})).json()
    assert [e["title"] for e in upcoming] == ["Entretien SRE"]


async def test_ics_export_and_feed_keep_a_stable_uid(client):
    created = (await client.post("/events", json=event())).json()
    response = await client.get(f"/events/{created['id']}/ics")
    assert response.headers["content-type"].startswith("text/calendar")
    assert "attachment" in response.headers["content-disposition"]
    vevent = Calendar.from_ical(response.content).walk("VEVENT")[0]
    assert str(vevent["UID"]) == f"{created['id']}@job-copilot"
    assert str(vevent["SUMMARY"]) == "Entretien SRE"
    assert "Visio : https://meet.example/abc" in str(vevent["DESCRIPTION"])
    assert vevent.walk("VALARM")
    await client.patch(f"/events/{created['id']}", json={"title": "Entretien final"})
    feed = Calendar.from_ical((await client.get("/feed.ics")).content)
    [updated] = feed.walk("VEVENT")
    assert str(updated["SUMMARY"]) == "Entretien final" and int(updated["SEQUENCE"]) == 1
    assert "attachment" not in (await client.get("/feed.ics")).headers.get(
        "content-disposition", ""
    )
    assert (
        "attachment" in (await client.get("/feed.ics?download=true")).headers["content-disposition"]
    )


async def test_caldav_copy_follows_create_update_delete(client, remote: DemoRemote):
    before = (await client.post("/events", json=event(title="Avant connexion"))).json()
    account = await connect(client)
    assert "password" not in json.dumps(account)
    uid = f"{before['id']}@job-copilot"
    assert uid in remote.events  # les événements à venir sont recopiés à la connexion
    created = (await client.post("/events", json=event())).json()
    assert created["synced_at"] and created["sync_error"] is None
    await client.patch(f"/events/{created['id']}", json={"location": "Lyon"})
    assert b"Lyon" in remote.events[f"{created['id']}@job-copilot"]
    assert (await client.delete(f"/events/{created['id']}")).status_code == 204
    assert f"{created['id']}@job-copilot" not in remote.events
    assert (await client.post("/accounts", json={})).status_code == 422


async def test_remote_failure_keeps_the_event_and_reports(client, remote: DemoRemote):
    await connect(client)
    remote.fail = True
    created = (await client.post("/events", json=event())).json()
    assert created["sync_error"]
    accounts = (await client.get("/accounts")).json()
    assert accounts[0]["last_error"]
    remote.fail = False
    report = (await client.post("/sync")).json()
    assert report == {"pushed": 1, "errors": []}
    assert (await client.get("/accounts")).json()[0]["last_error"] is None


async def test_one_calendar_at_a_time_and_disconnect(client):
    account = await connect(client)
    again = await client.post(
        "/accounts",
        json={"provider": "demo", "url": "demo", "username": "m", "calendar_url": "demo://x"},
    )
    assert again.status_code == 409
    assert (await client.delete(f"/accounts/{account['id']}")).status_code == 204
    assert (await client.get("/accounts")).json() == []


async def test_providers_explain_each_option(client):
    providers = {p["id"]: p for p in (await client.get("/providers")).json()}
    assert providers["icloud"]["url"] == "https://caldav.icloud.com"
    assert providers["google"]["caldav"] is False
    assert all(p["steps"] for key, p in providers.items() if key != "demo")
    assert "demo" in providers


async def test_discover_rejects_plain_http_and_bad_password(client, remote: DemoRemote):
    plain = {"provider": "other", "url": "http://caldav.example", "username": "m", "password": "x"}
    assert (await client.post("/accounts/discover", json=plain)).status_code == 422
    remote.fail = True
    bad = {"provider": "demo", "url": "demo", "username": "m", "password": "x"}
    response = await client.post("/accounts/discover", json=bad)
    assert response.status_code == 502 and "refusé" in response.json()["detail"]
