import httpx

from jobcopilot_jobs.connectors.adzuna import Adzuna
from jobcopilot_jobs.connectors.france_travail import FranceTravail
from jobcopilot_jobs.places import parse_place
from jobcopilot_jobs.schemas import Query


def test_places_are_read_as_country_region_department_or_city():
    assert parse_place("Belgique").kind == "country"
    assert parse_place("Belgique").country == "be"
    assert parse_place("Provence-Alpes-Côte d'Azur").code == "93"
    assert parse_place("Île-de-France").kind == "region"
    assert parse_place("Hauts-de-Seine (92)").code == "92"
    assert parse_place("Corse-du-Sud (2A)").code == "2A"
    assert parse_place("33").kind == "department"
    assert parse_place("Lyon").kind == "city"
    assert parse_place("Télétravail").kind == "anywhere"


async def test_france_travail_place_codes(cache):
    connector = FranceTravail(httpx.AsyncClient(), cache, "id", "secret")
    assert await connector.place("Île-de-France") == {"region": "11"}
    assert await connector.place("Gironde (33)") == {"departement": "33"}
    assert await connector.place("France") == {}
    assert await connector.place("Suisse") is None


async def test_adzuna_searches_the_chosen_country():
    seen: list[httpx.Request] = []

    def handler(request: httpx.Request) -> httpx.Response:
        seen.append(request)
        return httpx.Response(200, json={"results": []})

    client = httpx.AsyncClient(transport=httpx.MockTransport(handler))
    await Adzuna(client, "app", "key").search(Query(keywords="DevOps", location="Suisse"))
    await Adzuna(client, "app", "key").search(
        Query(keywords="DevOps", location="Hauts-de-Seine (92)")
    )
    assert "/jobs/ch/" in seen[0].url.path
    assert "where" not in seen[0].url.params
    assert "/jobs/fr/" in seen[1].url.path
    assert seen[1].url.params["where"] == "Hauts-de-Seine"
    assert "distance" not in seen[1].url.params
