from datetime import UTC, datetime, timedelta

import httpx
import pytest

from jobcopilot_jobs.connectors import SourceError
from jobcopilot_jobs.deps import get_cache, get_connectors, get_criteria, get_http
from jobcopilot_jobs.main import app
from jobcopilot_jobs.schemas import Criteria, Query, RawOffer

NOW = datetime.now(UTC)
CRITERIA = Criteria(
    roles=["Ingénieur DevOps"],
    technologies=["Kubernetes", "Terraform"],
    excluded_keywords=["ESN"],
    seniority="graduate",
    max_age_days=7,
)


def offer(source: str, external_id: str, title: str, hours: int, **fields) -> RawOffer:
    return RawOffer(
        source=source,
        external_id=external_id,
        title=title,
        company=fields.pop("company", "Nimbus"),
        location=fields.pop("location", "Paris"),
        contract=fields.pop("contract", "cdi"),
        description=fields.pop("description", ""),
        url=f"https://example.org/{external_id}",
        published_at=NOW - timedelta(hours=hours),
    )


class FakeSource:
    def __init__(self, name: str, offers: list[RawOffer], error: bool = False):
        self.name = self.label = name
        self.offers = offers
        self.error = error
        self.calls: list[Query] = []

    def configured(self) -> bool:
        return True

    async def search(self, query: Query) -> list[RawOffer]:
        self.calls.append(query)
        if self.error:
            raise SourceError("clé refusée")
        return self.offers


@pytest.fixture
def sources():
    return [
        FakeSource(
            "first",
            [
                offer("first", "a", "Ingénieur DevOps", 30, description="Kubernetes, Terraform"),
                offer("first", "b", "Ingénieur DevOps junior", 2),
                offer("first", "c", "Ingénieur DevOps", 5, company="Brume", description="Une ESN"),
                offer("first", "d", "Comptable", 1, company="Cabinet"),
                offer("first", "old", "Ingénieur DevOps", 24 * 10, company="Ancienne"),
            ],
        ),
        # Même offre que « b » vue par une autre source : elle doit être écartée.
        FakeSource("second", [offer("second", "x", "ingenieur devops JUNIOR", 2)]),
    ]


@pytest.fixture
async def client(database, cache, sources):
    app.dependency_overrides[get_criteria] = lambda: CRITERIA
    app.dependency_overrides[get_cache] = lambda: cache
    app.dependency_overrides[get_connectors] = lambda: sources
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://jobs") as client:
        yield client
    app.dependency_overrides.clear()


async def test_refresh_stores_recent_unique_offers(client, sources):
    response = await client.post("/refresh")
    assert response.status_code == 200
    body = response.json()
    # « old » sort de la fenêtre de 7 jours, « x » est un doublon de « b ».
    assert body["fetched"] == 5
    assert body["stored"] == 4
    assert body["duplicates"] == 1
    assert [s["status"] for s in body["sources"]] == ["ok", "ok"]
    assert sources[0].calls[0].keywords == "Ingénieur DevOps"
    assert sources[0].calls[0].max_age_days == 7


async def test_offers_are_newest_first_without_excluded_or_off_topic(client):
    await client.post("/refresh")
    body = (await client.get("/offers")).json()
    # « c » cite un mot exclu, « d » est hors sujet.
    assert [item["url"][-1] for item in body["items"]] == ["b", "a"]
    assert body["total"] == 2
    assert body["max_age_days"] == 7
    assert body["refreshed_at"] is not None


async def test_offers_sorted_by_relevance(client):
    await client.post("/refresh")
    items = (await client.get("/offers", params={"sort": "relevance"})).json()["items"]
    assert items[0]["url"].endswith("/a")
    assert items[0]["matched"] == ["Kubernetes", "Terraform"]
    assert items[0]["score"] > items[1]["score"]


async def test_window_can_be_narrowed(client):
    await client.post("/refresh")
    items = (await client.get("/offers", params={"max_age_days": 1})).json()["items"]
    assert [item["url"][-1] for item in items] == ["b"]


async def test_window_must_be_a_known_value(client):
    assert (await client.get("/offers", params={"max_age_days": 5})).status_code == 422


async def test_refresh_is_cached_until_forced(client, sources):
    await client.post("/refresh")
    cached = (await client.post("/refresh")).json()
    assert cached["cached"] is True
    assert len(sources[0].calls) == 1
    forced = (await client.post("/refresh", params={"force": True})).json()
    assert forced["cached"] is False
    assert len(sources[0].calls) == 2


async def test_failing_source_does_not_block_the_others(client, sources):
    sources[1].error = True
    body = (await client.post("/refresh")).json()
    assert body["sources"][1] == {
        "name": "second",
        "label": "second",
        "status": "error",
        "count": 0,
        "error": "clé refusée",
    }
    assert body["stored"] == 4
    # Pas de cache quand une source a échoué : on réessaie tout de suite.
    assert (await client.post("/refresh")).json()["cached"] is False


async def test_offer_detail(client):
    await client.post("/refresh")
    [first] = (await client.get("/offers", params={"sort": "relevance"})).json()["items"][:1]
    detail = (await client.get(f"/offers/{first['id']}")).json()
    assert detail["description"] == "Kubernetes, Terraform"
    assert (await client.get("/offers/999999")).status_code == 404


async def test_sources(client):
    body = (await client.get("/sources")).json()
    assert body == [
        {"name": "first", "label": "first", "configured": True},
        {"name": "second", "label": "second", "configured": True},
    ]


async def test_missing_profile_returns_conflict(client):
    del app.dependency_overrides[get_criteria]
    app.dependency_overrides[get_http] = lambda: httpx.AsyncClient(
        transport=httpx.MockTransport(lambda _: httpx.Response(404))
    )
    response = await client.get("/offers")
    assert response.status_code == 409
    assert "profil" in response.json()["detail"]


async def test_skills_mode_keeps_offers_citing_enough_chosen_skills(client):
    await client.post("/refresh")
    ids = {item["url"][-1]: item["id"] for item in (await client.get("/offers")).json()["items"]}
    app.dependency_overrides[get_criteria] = lambda: CRITERIA.model_copy(
        update={
            "match_mode": "skills",
            "focus_skills": ["Kubernetes", "Terraform"],
            "min_skills": 2,
        }
    )
    body = (await client.get("/offers")).json()
    assert [item["url"][-1] for item in body["items"]] == ["a"]
    assert body["hidden"] == 1
    # La fiche d'une offre sous le seuil reste lisible, par exemple depuis un autre profil.
    assert (await client.get(f"/offers/{ids['b']}")).status_code == 200


def profile_with_searches(_: httpx.Request) -> httpx.Response:
    return httpx.Response(
        200,
        json={
            "searches": [
                {"id": "devops", "name": "DevOps", "roles": ["DevOps"]},
                {"id": "data", "name": "Data", "roles": ["Data Engineer"], "match_mode": "skills"},
            ]
        },
    )


async def test_search_profile_is_chosen_by_id(client):
    del app.dependency_overrides[get_criteria]
    app.dependency_overrides[get_http] = lambda: httpx.AsyncClient(
        transport=httpx.MockTransport(profile_with_searches)
    )
    assert (await client.get("/offers")).json()["search"] == "devops"
    assert (await client.get("/offers", params={"search": "data"})).json()["search"] == "data"
    missing = await client.get("/offers", params={"search": "inconnu"})
    assert missing.status_code == 404
