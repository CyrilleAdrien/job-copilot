from fastapi.testclient import TestClient

from jobcopilot_jobs.main import app


def test_health():
    response = TestClient(app).get("/health")
    assert response.status_code == 200
    assert response.json() == {"service": "jobs", "status": "ok"}
