import uuid
from datetime import UTC, datetime, timedelta

import httpx
import pytest

from jobcopilot_applications import stats
from jobcopilot_applications.deps import get_cache
from jobcopilot_applications.main import app
from jobcopilot_applications.models import ApplicationRow, StatusEventRow

NOW = datetime(2026, 10, 30, 12, tzinfo=UTC)  # un vendredi


@pytest.fixture
async def client(database, cache):
    app.dependency_overrides[get_cache] = lambda: cache
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://applications") as client:
        yield client
    app.dependency_overrides.clear()


def application(
    status: str, applied_days_ago: int | None, *moves: tuple[str, int]
) -> ApplicationRow:
    """Candidature avec son historique : moves = (statut atteint, il y a n jours)."""
    applied = NOW - timedelta(days=applied_days_ago) if applied_days_ago is not None else None
    row = ApplicationRow(
        id=uuid.uuid4(),
        title=f"Poste {status}",
        company="Nimbus",
        status=status,
        applied_at=applied,
        created_at=NOW - timedelta(days=60),
    )
    row.events = [StatusEventRow(to_status="draft", created_at=NOW - timedelta(days=60))]
    if applied is not None:
        row.events.append(StatusEventRow(to_status="sent", created_at=applied))
    for to_status, days_ago in moves:
        row.events.append(
            StatusEventRow(to_status=to_status, created_at=NOW - timedelta(days=days_ago))
        )
    return row


def test_counts_rates_and_delays():
    rows = [
        application("draft", None),
        application("sent", 2),
        application("sent", 10),  # relance à faire
        application("followed_up", 20, ("followed_up", 8)),  # relance à faire
        application("interview", 12, ("interview", 8)),  # réponse en 4 jours
        application("rejected", 30, ("rejected", 20)),  # réponse en 10 jours
        application("offer", 40, ("interview", 34), ("offer", 30)),  # réponse en 6 jours
    ]
    result = stats.compute_stats(rows, NOW)
    assert result.total == 7
    assert result.sent == 6
    assert result.by_status["draft"] == 1
    assert result.by_status["sent"] == 2
    assert result.by_status["withdrawn"] == 0
    assert result.responded == 3
    assert result.response_rate == 0.5
    assert result.average_response_days == round((4 + 10 + 6) / 3, 1)
    assert [item.days for item in result.follow_ups] == [10, 8]  # la plus ancienne d'abord
    assert {item.status for item in result.follow_ups} == {"sent", "followed_up"}


def test_weekly_counts_cover_twelve_weeks_ending_this_week():
    rows = [
        application("sent", 0),
        application("sent", 1),
        application("sent", 7),
        application("sent", 200),
    ]
    weekly = stats.compute_stats(rows, NOW).weekly
    assert len(weekly) == stats.WEEKS
    assert weekly[-1].week.isoformat() == "2026-10-26"  # lundi de la semaine courante
    assert weekly[-1].sent == 2
    assert weekly[-2].sent == 1
    assert sum(week.sent for week in weekly) == 3  # l'envoi d'il y a 200 jours sort de la fenêtre


def test_no_application_gives_empty_stats():
    result = stats.compute_stats([], NOW)
    assert result.response_rate is None
    assert result.average_response_days is None
    assert result.follow_ups == []


async def test_stats_endpoint_is_cached_and_refreshed_after_each_change(client, cache):
    assert (await client.get("/stats")).json()["total"] == 0
    assert await cache.get(stats.CACHE_KEY) is not None
    created = (await client.post("/applications", json={"title": "SRE"})).json()
    assert await cache.get(stats.CACHE_KEY) is None
    body = (await client.get("/stats")).json()
    assert body["by_status"]["draft"] == 1
    await client.patch(f"/applications/{created['id']}", json={"status": "sent"})
    body = (await client.get("/stats")).json()
    assert body["sent"] == 1
    assert body["weekly"][-1]["sent"] == 1
    await client.delete(f"/applications/{created['id']}")
    assert (await client.get("/stats")).json()["total"] == 0


async def test_follow_up_restarts_the_wait_even_when_already_followed_up(client):
    created = (await client.post("/applications", json={"title": "SRE"})).json()
    path = f"/applications/{created['id']}/follow-up"
    assert (await client.post(path)).status_code == 409  # pas encore envoyée
    await client.patch(f"/applications/{created['id']}", json={"status": "sent"})
    assert (await client.post(path)).json()["status"] == "followed_up"
    body = (await client.post(path)).json()
    assert [e["to_status"] for e in body["events"]] == [
        "draft",
        "sent",
        "followed_up",
        "followed_up",
    ]
    assert (await client.get("/stats")).json()["by_status"]["followed_up"] == 1
