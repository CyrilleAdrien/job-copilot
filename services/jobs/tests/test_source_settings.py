import json

import httpx
import pytest
from sqlalchemy import text

from jobcopilot_common.db import get_sessionmaker
from jobcopilot_jobs.connectors import Adzuna, FranceTravail
from jobcopilot_jobs.connectors.france_travail import TOKEN_KEY
from jobcopilot_jobs.deps import get_cache, get_http
from jobcopilot_jobs.main import app
from jobcopilot_jobs.settings import get_jobs_settings


class Remote:
    """Faux France Travail et Adzuna : acceptent seulement les bonnes clés."""

    def __init__(self):
        self.up = True

    def __call__(self, request: httpx.Request) -> httpx.Response:
        if not self.up:
            raise httpx.ConnectError("refused", request=request)
        if "oauth2" in request.url.path:
            good = b"client_id=bon-id" in request.content
            token = {"access_token": "jeton", "expires_in": 1500}
            return httpx.Response(200, json=token) if good else httpx.Response(401)
        good = request.url.params.get("app_id") == "bon-id"
        return httpx.Response(200, json={"results": []}) if good else httpx.Response(401)


@pytest.fixture
def remote():
    return Remote()


@pytest.fixture
async def client(database, cache, remote, monkeypatch):
    # Vides plutôt qu'absentes : le .env du poste de développement ne doit pas compter.
    for name in (
        "FRANCE_TRAVAIL_CLIENT_ID",
        "FRANCE_TRAVAIL_CLIENT_SECRET",
        "ADZUNA_APP_ID",
        "ADZUNA_APP_KEY",
    ):
        monkeypatch.setenv(name, "")
    get_jobs_settings.cache_clear()
    app.dependency_overrides[get_cache] = lambda: cache
    app.dependency_overrides[get_http] = lambda: httpx.AsyncClient(
        transport=httpx.MockTransport(remote)
    )
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://jobs") as client:
        yield client
    app.dependency_overrides.clear()
    get_jobs_settings.cache_clear()


GOOD = {"key_id": "bon-id", "secret": "secret-tres-prive"}
BAD = {"key_id": "mauvais-id", "secret": "secret-tres-prive"}


async def by_name(client) -> dict:
    return {source["name"]: source for source in (await client.get("/sources")).json()}


@pytest.mark.parametrize("name", [FranceTravail.name, Adzuna.name])
async def test_good_keys_are_tested_encrypted_and_used(client, name):
    assert (await by_name(client))[name]["configured"] is False
    response = await client.put(f"/sources/{name}", json=GOOD)
    assert response.status_code == 200 and response.json()["origin"] == "settings"
    assert GOOD["secret"] not in response.text
    source = (await by_name(client))[name]
    assert source["configured"] is True and source["origin"] == "settings"
    tested = await client.post(f"/sources/{name}/test")
    assert tested.status_code == 200
    async with get_sessionmaker()() as session:
        stored = (
            await session.execute(text("SELECT secret_id, secret_key FROM jobs.source_credentials"))
        ).one()
    assert GOOD["secret"] not in stored.secret_key and stored.secret_key.startswith("gAAAA")


@pytest.mark.parametrize("name", [FranceTravail.name, Adzuna.name])
async def test_refused_keys_are_not_saved(client, name):
    response = await client.put(f"/sources/{name}", json=BAD)
    assert response.status_code == 400 and "refusés" in response.json()["detail"]
    assert (await by_name(client))[name]["configured"] is False


async def test_unreachable_source_is_explained_and_saves_nothing(client, remote):
    remote.up = False
    response = await client.put(f"/sources/{Adzuna.name}", json=GOOD)
    assert response.status_code == 400 and "injoignable" in response.json()["detail"]
    assert (await by_name(client))[Adzuna.name]["configured"] is False


async def test_settings_keys_take_over_from_env_and_give_it_back(client, monkeypatch):
    monkeypatch.setenv("ADZUNA_APP_ID", "id-env")
    monkeypatch.setenv("ADZUNA_APP_KEY", "cle-env")
    get_jobs_settings.cache_clear()
    assert (await by_name(client))[Adzuna.name]["origin"] == "env"
    await client.put(f"/sources/{Adzuna.name}", json=GOOD)
    assert (await by_name(client))[Adzuna.name]["origin"] == "settings"
    assert (await client.delete(f"/sources/{Adzuna.name}")).status_code == 204
    assert (await by_name(client))[Adzuna.name]["origin"] == "env"


async def test_removing_keys_forgets_the_france_travail_token(client, cache):
    await client.put(f"/sources/{FranceTravail.name}", json=GOOD)
    assert await cache.get(TOKEN_KEY) == "jeton"
    await client.delete(f"/sources/{FranceTravail.name}")
    assert await cache.get(TOKEN_KEY) is None
    assert (await by_name(client))[FranceTravail.name]["configured"] is False


async def test_unknown_source_and_source_without_keys(client):
    assert (await client.put("/sources/monster", json=GOOD)).status_code == 404
    assert (await client.post("/sources/monster/test")).status_code == 404
    assert (await client.post(f"/sources/{Adzuna.name}/test")).status_code == 409


async def test_keys_stay_out_of_the_export(client):
    await client.put(f"/sources/{Adzuna.name}", json=GOOD)
    exported = await client.get("/data/export")
    assert exported.json()["source_credentials"][0]["name"] == Adzuna.name
    assert "gAAAA" not in exported.text and GOOD["secret"] not in exported.text
    assert "secret_key" not in json.dumps(exported.json()["source_credentials"])


async def test_erase_removes_the_keys(client, cache, monkeypatch):
    monkeypatch.setattr("jobcopilot_jobs.main.get_cache", lambda: cache)
    await client.put(f"/sources/{Adzuna.name}", json=GOOD)
    assert (await client.delete("/data")).status_code == 204
    assert (await by_name(client))[Adzuna.name]["configured"] is False


async def test_search_delay_defaults_then_is_saved(client):
    settings = (await client.get("/search-settings")).json()
    assert settings == {"refresh_minutes": 15, "encryption": True}
    saved = await client.put("/search-settings", json={"refresh_minutes": 60})
    assert saved.status_code == 200 and saved.json()["refresh_minutes"] == 60
    assert (await client.get("/search-settings")).json()["refresh_minutes"] == 60


@pytest.mark.parametrize("minutes", [0, 4, 1441])
async def test_search_delay_stays_within_limits(client, minutes):
    response = await client.put("/search-settings", json={"refresh_minutes": minutes})
    assert response.status_code == 422
