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
    "searches": [
        {
            "name": "DevOps",
            "roles": ["Ingénieur SRE", "DevOps"],
            "technologies": ["Kubernetes", "Python"],
            "seniority": "mid",
            "contract_types": ["cdi"],
            "locations": ["Paris"],
            "max_age_days": 7,
        },
        {
            "name": "Data Engineer",
            "roles": ["Data Engineer"],
            "match_mode": "skills",
            "focus_skills": ["Python", "Airflow", "Spark"],
            "min_skills": 2,
        },
    ],
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
    "certifications": [{"name": "CKA", "issuer": "CNCF", "year": 2025}],
    "projects": [{"name": "job-copilot", "technologies": ["FastAPI"], "url": "https://x.dev"}],
    "volunteering": [{"role": "Mentor", "organization": "Asso", "start": "2023-01"}],
    "publications": [{"title": "Observabilité en pratique", "year": 2024}],
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
    assert [s["id"] for s in profile["searches"]] == ["devops", "data-engineer"]
    assert profile["searches"][1]["match_mode"] == "skills"
    assert profile["searches"][0]["min_skills"] == 2
    assert profile["certifications"][0]["issuer"] == "CNCF"
    assert profile["volunteering"][0]["organization"] == "Asso"


async def test_single_search_section_is_still_accepted(client):
    legacy = {k: v for k, v in PROFILE.items() if k != "searches"}
    legacy["search"] = {"roles": ["DevOps"], "max_age_days": 14}
    saved = await client.put("/", json=legacy)
    assert saved.status_code == 200
    searches = saved.json()["searches"]
    assert [(s["id"], s["name"], s["max_age_days"]) for s in searches] == [
        ("principal", "Principal", 14)
    ]


async def test_duplicate_search_names_get_distinct_ids(client):
    twice = PROFILE | {
        "searches": [{"name": "Data", "roles": ["A"]}, {"name": "Data", "roles": ["B"]}]
    }
    saved = (await client.put("/", json=twice)).json()
    assert [s["id"] for s in saved["searches"]] == ["data", "data-2"]


async def test_requires_at_least_one_search(client):
    response = await client.put("/", json=PROFILE | {"searches": []})
    assert response.status_code == 422


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
    bad = PROFILE | {"searches": [PROFILE["searches"][0] | {"max_age_days": 5}]}
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
    assert "searches.0.roles" in locations


async def test_import_rejects_broken_yaml(client):
    response = await client.post(
        "/import", content="identity: [", headers={"content-type": "application/yaml"}
    )
    assert response.status_code == 422


def test_example_profile_is_valid():
    from pathlib import Path

    from jobcopilot_profile.yaml_io import load_profile

    example = Path(__file__).parents[3] / "examples" / "profile.example.yaml"
    profile = load_profile(example.read_text())
    assert [search.id for search in profile.searches] == ["devops", "data-engineer"]


async def test_archive_restore_and_delete_a_search(client):
    await client.put("/", json=PROFILE)
    archived = (await client.post("/searches/data-engineer/archive")).json()
    assert [s["archived"] for s in archived["searches"]] == [False, True]
    # La dernière recherche active ne peut être ni archivée ni supprimée.
    assert (await client.post("/searches/devops/archive")).status_code == 409
    assert (await client.delete("/searches/devops")).status_code == 409
    restored = (await client.post("/searches/data-engineer/restore")).json()
    assert not restored["searches"][1]["archived"]
    deleted = (await client.delete("/searches/devops")).json()
    assert [s["id"] for s in deleted["searches"]] == ["data-engineer"]
    assert (await client.delete("/searches/inconnue")).status_code == 404


async def test_a_profile_keeps_one_active_search(client):
    searches = [{**search, "archived": True} for search in PROFILE["searches"]]
    response = await client.put("/", json={**PROFILE, "searches": searches})
    assert response.status_code == 422
