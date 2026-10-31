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
    status: str, applied_days_ago: int | None, *moves: tuple[str, int], search: str | None = None
) -> ApplicationRow:
    """Candidature avec son historique : moves = (statut atteint, il y a n jours)."""
    applied = NOW - timedelta(days=applied_days_ago) if applied_days_ago is not None else None
    row = ApplicationRow(
        id=uuid.uuid4(),
        title=f"Poste {status}",
        company="Nimbus",
        status=status,
        search_id=search,
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


def test_outcomes_by_search_rank_the_profile_that_gets_the_most_tests_and_interviews():
    rows = [
        # DevOps : 4 envois, un test technique puis refus, un entretien puis offre, un refus.
        application("rejected", 30, ("technical_test", 25), ("rejected", 20), search="devops"),
        application("offer", 30, ("interview", 25), ("offer", 20), search="devops"),
        application("rejected", 30, ("rejected", 28), search="devops"),
        application("sent", 3, search="devops"),
        # Data : 3 envois, un refus seulement.
        application("rejected", 30, ("rejected", 29), search="data"),
        application("sent", 10, search="data"),
        application("followed_up", 20, ("followed_up", 12), search="data"),
        # Cloud : 2 envois, un entretien, mais pas assez de données pour être classé.
        application("interview", 10, ("interview", 5), search="cloud"),
        application("sent", 10, search="cloud"),
        # À la main : exclues du classement.
        application("offer", 30, ("offer", 10)),
        application("draft", None, search="devops"),
    ]
    result = stats.compute_stats(rows, NOW)
    by_id = {o.search_id: o for o in result.by_search}
    devops = by_id["devops"]
    assert (devops.sent, devops.responded, devops.technical_tests, devops.interviews) == (
        4,
        3,
        1,
        1,
    )
    assert (devops.offers, devops.rejected) == (1, 2)
    assert devops.progress_rate == 0.5
    assert devops.response_rate == 0.75
    assert by_id["data"].progress_rate == 0.0
    assert by_id["cloud"].progress_rate == 0.5
    assert result.best_search == "devops"  # cloud a le même taux mais moins de 3 envois
    assert result.responded == 6  # le test technique compte comme une réponse


def test_no_best_search_without_enough_progress():
    rows = [application("rejected", 30, ("rejected", 20), search="data") for _ in range(3)]
    assert stats.compute_stats(rows, NOW).best_search is None


async def test_unreadable_cache_is_ignored(client, cache):
    """Un cache d'un ancien format (sans by_search, par exemple) ne fait pas échouer /stats."""
    await cache.set(stats.CACHE_KEY, '{"total": 1}')
    response = await client.get("/stats")
    assert response.status_code == 200
    assert response.json()["by_search"] == []
