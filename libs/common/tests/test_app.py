import pytest
from fastapi.testclient import TestClient

from jobcopilot_common import create_service_app, health


async def ok(_settings):
    return None


async def down(_settings):
    raise ConnectionError("refused")


def test_health_is_always_ok():
    client = TestClient(create_service_app("demo", ["postgres"]))
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"service": "demo", "status": "ok"}


def test_ready_when_all_dependencies_answer(monkeypatch):
    monkeypatch.setitem(health.CHECKS, "postgres", ok)
    monkeypatch.setitem(health.CHECKS, "redis", ok)
    client = TestClient(create_service_app("demo", ["postgres", "redis"]))
    response = client.get("/ready")
    assert response.status_code == 200
    assert response.json()["checks"] == {"postgres": "ok", "redis": "ok"}


def test_ready_degraded_when_a_dependency_is_down(monkeypatch):
    monkeypatch.setitem(health.CHECKS, "postgres", ok)
    monkeypatch.setitem(health.CHECKS, "redis", down)
    client = TestClient(create_service_app("demo", ["postgres", "redis"]))
    response = client.get("/ready")
    assert response.status_code == 503
    body = response.json()
    assert body["status"] == "degraded"
    assert body["checks"]["redis"] == "error: ConnectionError"


def test_unknown_dependency_is_rejected():
    with pytest.raises(ValueError):
        create_service_app("demo", ["mongodb"])
