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
        "address": "1 rue de la Paix",
        "birth_date": "1998-03-14",
        "nationality": "Française",
        "driving_licence": "B",
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
    "awards": [{"title": "Prix de l'innovation", "issuer": "BPCE", "year": 2025}],
    "courses": [{"name": "Kubernetes avancé", "institution": "Linux Foundation", "year": 2025}],
    "referees": [{"name": "Sam Durand", "role": "Responsable", "email": "sam@example.com"}],
    "custom_sections": [{"title": "Conférences", "items": ["DevOps Days 2025"]}],
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
    assert [e["company"] for e in profile["searches"][0]["cv"]["experiences"]] == [
        "Banque Exemple",
        "Startup",
    ]
    assert profile["searches"][0]["cv"]["experiences"][0]["groups"][0]["bullets"] == [
        "Pipelines CI/CD refondus"
    ]
    assert [s["id"] for s in profile["searches"]] == ["devops", "data-engineer"]
    assert profile["searches"][1]["match_mode"] == "skills"
    assert profile["searches"][0]["min_skills"] == 2
    assert profile["searches"][0]["cv"]["certifications"][0]["issuer"] == "CNCF"
    assert profile["searches"][1]["cv"]["volunteering"][0]["organization"] == "Asso"


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
    assert [e["company"] for e in profile["searches"][0]["cv"]["experiences"]] == ["Startup"]


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
    assert (
        yaml.safe_load(exported.text)["searches"][0]["cv"]["headline"] == "Ingénieur DevOps / SRE"
    )

    await client.delete("/")
    imported = await client.post(
        "/import", content=exported.text, headers={"content-type": "application/yaml"}
    )
    assert imported.status_code == 200
    assert imported.json() == original


async def test_import_reports_invalid_fields(client):
    content = yaml.safe_dump({"identity": {"email": "faux"}, "search": {"roles": []}})
    response = await client.post(
        "/import", content=content, headers={"content-type": "application/yaml"}
    )
    assert response.status_code == 422
    locations = {error["loc"] for error in response.json()["detail"]["errors"]}
    assert "identity.full_name" in locations
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


PNG = b"\x89PNG\r\n\x1a\n" + b"0" * 32
JPEG = b"\xff\xd8\xff\xe0" + b"0" * 32
WEBP = b"RIFF\x10\x00\x00\x00WEBP" + b"0" * 32


async def test_no_photo_yet(client):
    assert (await client.get("/photo")).status_code == 404
    assert (await client.get("/photo/info")).json() == {"updated_at": None}
    assert (await client.delete("/photo")).status_code == 204


@pytest.mark.parametrize(
    ("data", "content_type"), [(PNG, "image/png"), (JPEG, "image/jpeg"), (WEBP, "image/webp")]
)
async def test_photo_is_served_with_the_type_of_its_content(client, data, content_type):
    # Le type déclaré par le client ne compte pas.
    saved = await client.put("/photo", content=data, headers={"content-type": "text/html"})
    assert saved.status_code == 200
    photo = await client.get("/photo")
    assert photo.content == data
    assert photo.headers["content-type"] == content_type
    assert (await client.get("/photo/info")).json() == saved.json()


async def test_replacing_a_photo_changes_its_version(client):
    first = (await client.put("/photo", content=PNG)).json()["updated_at"]
    second = (await client.put("/photo", content=JPEG)).json()["updated_at"]
    assert second > first
    assert (await client.get("/photo")).content == JPEG


@pytest.mark.parametrize(
    "data", [b"", b"<svg xmlns='http://www.w3.org/2000/svg'/>", b"<html></html>", b"RIFFxxxxWAVE"]
)
async def test_other_files_are_refused(client, data):
    assert (await client.put("/photo", content=data)).status_code == 415
    assert (await client.get("/photo")).status_code == 404


async def test_too_heavy_photo_is_refused(client):
    response = await client.put("/photo", content=PNG + b"0" * (2 * 1024 * 1024))
    assert response.status_code == 413
    assert (await client.get("/photo")).status_code == 404


async def test_photo_survives_profile_changes_and_stays_out_of_the_profile(client):
    await client.put("/", json=PROFILE)
    await client.put("/photo", content=PNG)
    await client.put("/", json=PROFILE)
    exported = await client.get("/export")
    await client.post(
        "/import", content=exported.content, headers={"content-type": "application/yaml"}
    )
    assert (await client.get("/photo")).content == PNG
    assert "photo" not in (await client.get("/")).text
    assert "photo" not in exported.text


async def test_deleting_the_profile_deletes_the_photo(client):
    await client.put("/", json=PROFILE)
    await client.put("/photo", content=PNG)
    assert (await client.delete("/")).status_code == 204
    assert (await client.get("/photo")).status_code == 404


async def test_removing_the_photo_keeps_the_profile(client):
    await client.put("/", json=PROFILE)
    await client.put("/photo", content=PNG)
    assert (await client.delete("/photo")).status_code == 204
    assert (await client.get("/photo")).status_code == 404
    assert (await client.get("/")).status_code == 200


async def test_cv_details_round_trip(client):
    await client.put("/", json=PROFILE)
    profile = (await client.get("/")).json()
    assert profile["identity"]["driving_licence"] == "B"
    assert profile["identity"]["birth_date"] == "1998-03-14"
    cv = profile["searches"][0]["cv"]
    assert cv["awards"][0]["title"] == "Prix de l'innovation"
    assert cv["courses"][0]["institution"] == "Linux Foundation"
    assert cv["referees"][0]["name"] == "Sam Durand"
    assert cv["custom_sections"][0]["items"] == ["DevOps Days 2025"]


async def test_education_keeps_place_and_dates(client):
    education = [
        {
            "degree": "Master",
            "school": "ESEO",
            "location": "Paris",
            "start": "2024-09",
            "end": "2026-08",
        }
    ]
    response = await client.put("/", json={**PROFILE, "education": education})
    assert response.status_code == 200
    education = response.json()["searches"][0]["cv"]["education"]
    assert education[0]["location"] == "Paris"
    assert education[0]["end"] == "2026-08"


async def test_invalid_birth_date_is_refused(client):
    identity = {**PROFILE["identity"], "birth_date": "14/03/1998"}
    response = await client.put("/", json={**PROFILE, "identity": identity})
    assert response.status_code == 422


async def test_older_shared_cv_is_copied_into_each_search(client):
    response = await client.put("/", json=PROFILE)
    assert response.status_code == 200
    first, second = response.json()["searches"]
    assert first["cv"] == second["cv"]
    assert first["cv"]["headline"] == "Ingénieur DevOps / SRE"
    assert "headline" not in response.json()["identity"]
    assert "experiences" not in response.json()


async def test_each_search_keeps_its_own_cv(client):
    saved = (await client.put("/", json=PROFILE)).json()
    saved["searches"][1]["cv"] = {
        "headline": "Infirmière",
        "experiences": [{"title": "Infirmière", "company": "CHU", "start": "2020-01"}],
    }
    profile = (await client.put("/", json=saved)).json()
    first, second = profile["searches"]
    assert second["cv"]["headline"] == "Infirmière"
    assert second["cv"]["skills"] == []
    assert first["cv"]["headline"] == "Ingénieur DevOps / SRE"
    assert [e["company"] for e in first["cv"]["experiences"]] != ["CHU"]


async def test_export_then_import_keeps_every_cv(client):
    saved = (await client.put("/", json=PROFILE)).json()
    saved["searches"][1]["cv"]["headline"] = "Data Engineer"
    await client.put("/", json=saved)
    exported = await client.get("/export")
    imported = await client.post(
        "/import", content=exported.text, headers={"content-type": "application/yaml"}
    )
    assert imported.status_code == 200
    assert [s["cv"]["headline"] for s in imported.json()["searches"]] == [
        "Ingénieur DevOps / SRE",
        "Data Engineer",
    ]


def primary_ids(profile: dict) -> list[str]:
    return [search["id"] for search in profile["searches"] if search["primary"]]


async def test_first_active_search_is_primary_by_default(client):
    profile = (await client.put("/", json=PROFILE)).json()
    assert primary_ids(profile) == ["devops"]


async def test_primary_search_can_be_chosen(client):
    await client.put("/", json=PROFILE)
    response = await client.post("/searches/data-engineer/primary")
    assert response.status_code == 200
    assert primary_ids(response.json()) == ["data-engineer"]
    assert primary_ids((await client.get("/")).json()) == ["data-engineer"]
    assert (await client.post("/searches/inconnue/primary")).status_code == 404


async def test_archiving_the_primary_search_moves_it_to_an_active_one(client):
    await client.put("/", json=PROFILE)
    await client.post("/searches/data-engineer/primary")
    profile = (await client.post("/searches/data-engineer/archive")).json()
    assert primary_ids(profile) == ["devops"]
    # La restaurer ne lui rend pas sa place : le choix reste à la personne.
    assert primary_ids((await client.post("/searches/data-engineer/restore")).json()) == ["devops"]


async def test_archived_search_cannot_be_primary(client):
    await client.put("/", json=PROFILE)
    await client.post("/searches/data-engineer/archive")
    response = await client.post("/searches/data-engineer/primary")
    assert response.status_code == 409
    assert "Restaure" in response.json()["detail"]


async def test_deleting_the_primary_search_moves_it(client):
    await client.put("/", json=PROFILE)
    await client.post("/searches/data-engineer/primary")
    profile = (await client.delete("/searches/data-engineer")).json()
    assert primary_ids(profile) == ["devops"]


async def test_private_details_are_hidden_by_default(client):
    profile = (await client.put("/", json=PROFILE)).json()
    assert profile["searches"][0]["cv_layout"] == {
        "hidden": ["address", "birth_date", "nationality", "referees"],
        "order": [],
        "labels": {},
        "font": None,
        "colors": None,
    }


async def test_layout_is_saved_per_search(client):
    await client.put("/", json=PROFILE)
    layout = {
        "hidden": ["photo"],
        "order": ["projects", "experience"],
        "labels": {"skills": {"fr": "Savoir-faire", "en": "Know-how"}},
        "font": "Lato",
        "colors": {"background": "#FBF7EF", "text": "#1F2A44", "rule": "#2F6FED"},
    }
    response = await client.put("/searches/data-engineer/layout", json=layout)
    assert response.status_code == 200
    first, second = (await client.get("/")).json()["searches"]
    assert second["cv_layout"] == layout
    assert first["cv_layout"]["order"] == []
    assert second["cv"]["headline"] == first["cv"]["headline"]
    assert (await client.put("/searches/inconnue/layout", json=layout)).status_code == 404


async def test_layout_is_kept_when_exporting(client):
    await client.put("/", json=PROFILE)
    layout = {"hidden": [], "order": ["projects"], "labels": {}}
    await client.put("/searches/devops/layout", json=layout)
    exported = await client.get("/export")
    imported = await client.post(
        "/import", content=exported.text, headers={"content-type": "application/yaml"}
    )
    assert imported.json()["searches"][0]["cv_layout"]["order"] == ["projects"]


async def test_section_name_length_is_limited(client):
    await client.put("/", json=PROFILE)
    layout = {"labels": {"skills": {"fr": "x" * 81}}}
    assert (await client.put("/searches/devops/layout", json=layout)).status_code == 422


async def test_invalid_color_is_refused(client):
    await client.put("/", json=PROFILE)
    layout = {"colors": {"text": "rouge"}}
    assert (await client.put("/searches/devops/layout", json=layout)).status_code == 422
