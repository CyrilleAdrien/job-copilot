import httpx
import pytest
import yaml

from jobcopilot_profile.main import app

PROFILE = {
    "identity": {
        "full_name": "Alex Martin",
        "headline": "Ingénieur DevOps / SRE",
        "email": "alex@example.com",
        "location": "Paris",
        "links": [{"label": "GitHub", "url": "https://github.com/alex"}],
    },
    "search": {
        "roles": ["Ingénieur SRE", "DevOps"],
        "technologies": ["Kubernetes", "Python"],
        "seniority": "mid",
        "contract_types": ["cdi"],
        "locations": ["Paris"],
        "max_age_days": 7,
    },
    "experiences": [
        {
            "title": "Ingénieur DevOps",
            "company": "Banque Exemple",
            "start": "2024-09",
            "end": "2026-09",
            "groups": [
                {"title": "Automatisation", "bullets": ["Pipelines CI/CD refondus"]},
            ],
            "technologies": ["Jenkins"],
        },
        {"title": "Stagiaire", "company": "Startup", "start": "2023-03", "end": "2023-08"},
    ],
    "skills": [{"name": "Conteneurs", "items": ["Docker", "Kubernetes"]}],
    "languages": [{"name": "Anglais", "level": "B2"}],
}

pytestmark = pytest.mark.usefixtures("database")


@pytest.fixture
async def client():
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://profile") as client:
        yield client


async def test_no_profile_yet(client):
    response = await client.get("/")
    assert response.status_code == 404


async def test_save_then_read_keeps_order_and_nested_fields(client):
    saved = await client.put("/", json=PROFILE)
    assert saved.status_code == 200

    profile = (await client.get("/")).json()
    assert profile["identity"]["full_name"] == "Alex Martin"
    assert [e["company"] for e in profile["experiences"]] == ["Banque Exemple", "Startup"]
    assert profile["experiences"][0]["groups"][0]["bullets"] == ["Pipelines CI/CD refondus"]
    assert profile["search"]["max_age_days"] == 7


async def test_save_replaces_experiences(client):
    await client.put("/", json=PROFILE)
    updated = PROFILE | {"experiences": PROFILE["experiences"][1:]}
    await client.put("/", json=updated)
    profile = (await client.get("/")).json()
    assert [e["company"] for e in profile["experiences"]] == ["Startup"]


async def test_rejects_end_before_start(client):
    bad = PROFILE | {
        "experiences": [{"title": "X", "company": "Y", "start": "2025-05", "end": "2024-01"}]
    }
    response = await client.put("/", json=bad)
    assert response.status_code == 422


async def test_rejects_unknown_date_window(client):
    bad = PROFILE | {"search": PROFILE["search"] | {"max_age_days": 5}}
    response = await client.put("/", json=bad)
    assert response.status_code == 422


async def test_export_then_import_round_trip(client):
    original = (await client.put("/", json=PROFILE)).json()
    exported = await client.get("/export")
    assert exported.headers["content-type"].startswith("application/yaml")
    assert yaml.safe_load(exported.text)["identity"]["headline"] == "Ingénieur DevOps / SRE"

    await client.delete("/")
    imported = await client.post(
        "/import", content=exported.text, headers={"content-type": "application/yaml"}
    )
    assert imported.status_code == 200
    assert imported.json() == original


async def test_import_reports_invalid_fields(client):
    content = yaml.safe_dump({"identity": {"full_name": "A"}, "search": {"roles": []}})
    response = await client.post(
        "/import", content=content, headers={"content-type": "application/yaml"}
    )
    assert response.status_code == 422
    locations = {error["loc"] for error in response.json()["detail"]["errors"]}
    assert "identity.headline" in locations
    assert "search.roles" in locations


async def test_import_rejects_broken_yaml(client):
    response = await client.post(
        "/import", content="identity: [", headers={"content-type": "application/yaml"}
    )
    assert response.status_code == 422
