import json

import httpx
import pytest

from jobcopilot_jobs.connectors import Adzuna, FranceTravail, SourceError
from jobcopilot_jobs.connectors.base import clean_text
from jobcopilot_jobs.schemas import Query

QUERY = Query(keywords="DevOps", location="Paris", radius_km=20, max_age_days=30)


def france_travail_handler(calls: list[httpx.Request], search_status: int = 200):
    def handler(request: httpx.Request) -> httpx.Response:
        calls.append(request)
        if request.url.path.endswith("/access_token"):
            return httpx.Response(200, json={"access_token": "tok", "expires_in": 1499})
        if request.url.host == "geo.api.gouv.fr":
            return httpx.Response(200, json=[{"code": "75056", "nom": "Paris"}])
        if search_status != 200:
            return httpx.Response(search_status)
        return httpx.Response(
            206,
            json={
                "resultats": [
                    {
                        "id": "201ABCD",
                        "intitule": "Ingénieur DevOps (H/F)",
                        "description": "Kubernetes et Terraform.<br>Télétravail partiel.",
                        "dateCreation": "2026-10-25T08:30:00.000Z",
                        "lieuTravail": {"libelle": "75 - Paris 9e Arrondissement"},
                        "entreprise": {"nom": "Nimbus"},
                        "typeContrat": "CDI",
                        "salaire": {"libelle": "Annuel de 42000 à 48000 Euros"},
                    }
                ]
            },
        )

    return handler


async def test_france_travail_search(cache):
    calls: list[httpx.Request] = []
    client = httpx.AsyncClient(transport=httpx.MockTransport(france_travail_handler(calls)))
    connector = FranceTravail(client, cache, "id", "secret")

    [offer] = await connector.search(QUERY)

    assert offer.title == "Ingénieur DevOps (H/F)"
    assert offer.contract == "cdi"
    assert offer.description == "Kubernetes et Terraform.\nTélétravail partiel."
    assert offer.url.endswith("/detail/201ABCD")
    assert offer.published_at.isoformat() == "2026-10-25T08:30:00+00:00"
    search = calls[-1]
    assert search.headers["authorization"] == "Bearer tok"
    # Paris a des arrondissements : la recherche se fait sur le département.
    assert search.url.params["departement"] == "75"
    assert search.url.params["publieeDepuis"] == "31"
    assert search.url.params["sort"] == "1"


async def test_france_travail_caches_token_and_place(cache):
    calls: list[httpx.Request] = []
    client = httpx.AsyncClient(transport=httpx.MockTransport(france_travail_handler(calls)))
    connector = FranceTravail(client, cache, "id", "secret")
    await connector.search(QUERY)
    await connector.search(QUERY)
    assert len(calls) == 4


async def test_france_travail_no_content(cache):
    client = httpx.AsyncClient(transport=httpx.MockTransport(france_travail_handler([], 204)))
    assert await FranceTravail(client, cache, "id", "secret").search(QUERY) == []


async def test_france_travail_error(cache):
    client = httpx.AsyncClient(transport=httpx.MockTransport(france_travail_handler([], 500)))
    with pytest.raises(SourceError):
        await FranceTravail(client, cache, "id", "secret").search(QUERY)


def test_france_travail_needs_both_keys(cache):
    assert not FranceTravail(httpx.AsyncClient(), cache, "id", None).configured()


async def test_adzuna_search():
    seen: list[httpx.Request] = []

    def handler(request: httpx.Request) -> httpx.Response:
        seen.append(request)
        body = {
            "results": [
                {
                    "id": "4321",
                    "title": "<strong>DevOps</strong> Engineer",
                    "description": "Docker &amp; Kubernetes",
                    "created": "2026-10-24T10:00:00Z",
                    "company": {"display_name": "Helio"},
                    "location": {"display_name": "Lyon, Rhône"},
                    "redirect_url": "https://www.adzuna.fr/details/4321",
                    "contract_type": "permanent",
                    "salary_min": 45000,
                    "salary_max": 55000,
                    "salary_is_predicted": "0",
                }
            ]
        }
        return httpx.Response(200, content=json.dumps(body))

    client = httpx.AsyncClient(transport=httpx.MockTransport(handler))
    [offer] = await Adzuna(client, "app", "key").search(QUERY)

    assert offer.title == "DevOps Engineer"
    assert offer.description == "Docker & Kubernetes"
    assert offer.contract == "cdi"
    assert offer.salary == "45 000 – 55 000 € par an"
    params = seen[0].url.params
    assert params["what"] == "DevOps"
    assert params["where"] == "Paris"
    assert params["max_days_old"] == "30"
    assert params["sort_by"] == "date"


async def test_adzuna_rejected_keys():
    client = httpx.AsyncClient(transport=httpx.MockTransport(lambda _: httpx.Response(401)))
    with pytest.raises(SourceError, match="refusés"):
        await Adzuna(client, "app", "bad").search(QUERY)


def test_clean_text():
    assert clean_text("<p>Un</p><p>Deux &eacute;</p>") == "Un\nDeux é"
