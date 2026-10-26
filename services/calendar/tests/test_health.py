from fastapi.testclient import TestClient

from jobcopilot_calendar.main import app


def test_health():
    response = TestClient(app).get("/health")
    assert response.status_code == 200
    assert response.json() == {"service": "calendar", "status": "ok"}
