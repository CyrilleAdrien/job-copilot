import copy
import os

import pytest
from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine

# Base de test : la CI fournit un Postgres, en local `make test-db` en lance un.
TEST_DATABASE_URL = os.environ.setdefault(
    "TEST_DATABASE_URL", "postgresql://postgres@127.0.0.1:5433/jobcopilot_test"
)
os.environ["DATABASE_URL"] = TEST_DATABASE_URL

from jobcopilot_common.db import async_url, get_engine, get_sessionmaker  # noqa: E402
from jobcopilot_documents.migrate import upgrade  # noqa: E402
from jobcopilot_documents.schemas import Offer, Profile  # noqa: E402


@pytest.fixture
async def database():
    engine = create_async_engine(async_url(TEST_DATABASE_URL))
    async with engine.begin() as connection:
        await connection.execute(text('DROP SCHEMA IF EXISTS "documents" CASCADE'))
    await engine.dispose()
    await upgrade(TEST_DATABASE_URL)
    yield
    await get_engine().dispose()
    get_sessionmaker.cache_clear()
    get_engine.cache_clear()


PROFILE = {
    "identity": {
        "full_name": "Alex Martin",
        "headline": "Ingénieur DevOps",
        "email": "alex@example.org",
        "phone": "06 00 00 00 00",
        "location": "Lyon",
        "availability": "Disponible immédiatement",
        "summary": "Ingénieur DevOps avec 2 ans d'expérience sur Kubernetes et Terraform.",
        "links": [{"label": "GitHub", "url": "https://github.com/alex"}],
    },
    "search": {"roles": ["Ingénieur DevOps"], "contract_types": ["cdi"]},
    "experiences": [
        {
            "title": "Ingénieur DevOps",
            "company": "Nimbus",
            "contract": "Alternance",
            "start": "2024-09",
            "end": None,
            "context": "Plateforme de paiement.",
            "groups": [
                {
                    "title": "Automatisation",
                    "bullets": [
                        "Réduit le temps de déploiement de 45 à 10 minutes avec GitLab CI.",
                        "Migré 30 services vers Kubernetes.",
                    ],
                }
            ],
            "technologies": ["Kubernetes", "GitLab CI"],
        },
        {
            "title": "Technicien support",
            "company": "Brume",
            "start": "2022-01",
            "end": "2023-06",
            "groups": [{"title": None, "bullets": ["Traité les incidents de niveau 1."]}],
        },
    ],
    "education": [{"degree": "Diplôme d'ingénieur", "school": "ESEO", "year": 2026}],
    "skills": [{"name": "Cloud", "items": ["Kubernetes", "Terraform"]}],
    "languages": [{"name": "Anglais", "level": "B2"}],
    "soft_skills": ["Rigueur"],
    "interests": ["Football"],
}

OFFER = {
    "id": 7,
    "source": "demo",
    "title": "Ingénieur DevOps",
    "company": "Helio",
    "location": "Paris",
    "contract": "cdi",
    "url": "https://example.org/offre/7",
    "description": "Vous rejoindrez une équipe de 12 personnes pour opérer nos clusters.",
    "matched": ["Kubernetes"],
}


@pytest.fixture
def profile_data():
    return copy.deepcopy(PROFILE)


@pytest.fixture
def offer_data():
    return copy.deepcopy(OFFER)


@pytest.fixture
def profile(profile_data):
    return Profile.model_validate(profile_data)


@pytest.fixture
def offer(offer_data):
    return Offer.model_validate(offer_data)
