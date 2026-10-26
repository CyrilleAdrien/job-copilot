import httpx
from fastapi.testclient import TestClient

from jobcopilot_gateway import main


def fake_fetch(down: set[str]):
    async def fetch(_client, name):
        status = "unreachable" if name in down else "ok"
        return {"service": name, "status": status}

    return fetch


def test_health():
    response = TestClient(main.app).get("/health")
    assert response.status_code == 200
    assert response.json() == {"service": "gateway", "status": "ok"}


def test_ready_aggregates_services(monkeypatch):
    monkeypatch.setattr(main, "fetch_ready", fake_fetch(down=set()))
    response = TestClient(main.app).get("/ready")
    assert response.status_code == 200
    assert set(response.json()["services"]) == set(main.SERVICES)


def test_ready_degraded_when_a_service_is_down(monkeypatch):
    monkeypatch.setattr(main, "fetch_ready", fake_fetch(down={"mail"}))
    response = TestClient(main.app).get("/ready")
    assert response.status_code == 503
    assert response.json()["services"]["mail"]["status"] == "unreachable"


async def test_fetch_ready_reports_unreachable_service():
    def refuse(request):
        raise httpx.ConnectError("refused", request=request)

    async with httpx.AsyncClient(transport=httpx.MockTransport(refuse)) as client:
        result = await main.fetch_ready(client, "jobs")
    assert result == {"service": "jobs", "status": "unreachable", "error": "ConnectError"}
