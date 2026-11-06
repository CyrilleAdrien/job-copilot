import json

import httpx
import pytest
from fakeredis import FakeAsyncRedis
from fastapi.testclient import TestClient

from jobcopilot_common.llm import MODEL_KEY
from jobcopilot_common.mode import MODE_KEY
from jobcopilot_gateway import main, system

LOCAL = "http://localhost"


@pytest.fixture
def cache(monkeypatch):
    fake = FakeAsyncRedis(decode_responses=True)
    # La dépendance d'abord, sur la fonction d'origine ; puis les appels directs (data, setup).
    main.app.dependency_overrides[system.get_cache] = lambda: fake
    monkeypatch.setattr(system, "get_cache", lambda: fake)
    for flag in ("LLM_PROVIDER", "JOBS_DEMO", "MAIL_DEMO", "CALENDAR_DEMO"):
        monkeypatch.delenv(flag, raising=False)
    yield fake
    main.app.dependency_overrides.clear()


class Services:
    """Les six services, réduits à ce que la démonstration appelle."""

    def __init__(self, profile=False, mailboxes=(), calendars=(), fail=None):
        self.profile, self.mailboxes, self.calendars, self.fail = (
            profile,
            list(mailboxes),
            list(calendars),
            fail,
        )
        self.calls: list[tuple[str, str]] = []

    def __call__(self, request: httpx.Request) -> httpx.Response:
        key = (request.method, f"{request.url.host}{request.url.path}")
        self.calls.append(key)
        if self.fail and request.url.host == self.fail:
            return httpx.Response(500)
        match key:
            case ("GET", "profile/"):
                return httpx.Response(200 if self.profile else 404, json={})
            case ("POST", "profile/import"):
                assert request.headers["content-type"] == "application/yaml"
                assert b"Alex Martin" in request.content
                self.profile = True
                return httpx.Response(200, json={})
            case ("GET", "mail/accounts"):
                return httpx.Response(200, json=self.mailboxes)
            case ("POST", "mail/accounts"):
                assert json.loads(request.content)["host"] == "demo"
                self.mailboxes.append({})
                return httpx.Response(201, json={})
            case ("GET", "calendar/accounts"):
                return httpx.Response(200, json=self.calendars)
            case ("POST", "calendar/accounts"):
                assert json.loads(request.content)["url"] == "demo"
                self.calendars.append({})
                return httpx.Response(201, json={})
            case ("POST", "jobs/refresh"):
                return httpx.Response(200, json={"stored": 12})
            case ("DELETE", _):
                return httpx.Response(204)
        raise AssertionError(f"appel inattendu : {key}")


def mock_services(monkeypatch, services: Services) -> None:
    real_client = httpx.AsyncClient

    def client(*args, **kwargs):
        return real_client(*args, **kwargs, transport=httpx.MockTransport(services))

    monkeypatch.setattr(main.httpx, "AsyncClient", client)


def api():
    return TestClient(main.app, base_url=LOCAL)


def test_mode_is_unset_until_the_assistant_is_done(cache):
    assert api().get("/api/system/mode").json() == {"mode": None, "forced_demo": False}
    assert api().put("/api/system/mode", json={"mode": "real"}).json()["mode"] == "real"
    assert api().get("/api/system/mode").json()["mode"] == "real"


def test_an_unknown_mode_is_refused(cache):
    assert api().put("/api/system/mode", json={"mode": "maybe"}).status_code == 422


def test_demo_prepares_everything_in_one_call(cache, monkeypatch):
    services = Services()
    mock_services(monkeypatch, services)
    response = api().post("/api/system/demo")
    assert response.status_code == 200 and response.json()["mode"] == "demo"
    assert ("POST", "profile/import") in services.calls
    assert ("POST", "mail/accounts") in services.calls
    assert ("POST", "calendar/accounts") in services.calls
    assert services.calls[-1] == ("POST", "jobs/refresh")


def test_demo_keeps_what_already_exists_and_can_be_retried(cache, monkeypatch):
    services = Services(profile=True, mailboxes=[{}], calendars=[{}])
    mock_services(monkeypatch, services)
    assert api().post("/api/system/demo").status_code == 200
    assert not any(method == "POST" and path != "jobs/refresh" for method, path in services.calls)


def test_a_failed_demo_step_is_named(cache, monkeypatch):
    mock_services(monkeypatch, Services(fail="calendar"))
    response = api().post("/api/system/demo")
    assert response.status_code == 502 and response.json()["detail"].startswith("Calendrier")


def test_leaving_the_demo_requires_erasing_its_data(cache, monkeypatch):
    mock_services(monkeypatch, Services())
    client = api()
    client.post("/api/system/demo")
    assert client.put("/api/system/mode", json={"mode": "real"}).status_code == 409

    assert client.delete("/api/data").status_code == 204
    assert client.get("/api/system/mode").json()["mode"] is None
    assert client.put("/api/system/mode", json={"mode": "real"}).json()["mode"] == "real"


async def test_erasing_forgets_the_model_and_the_mode(cache, monkeypatch):
    mock_services(monkeypatch, Services())
    await cache.set(MODEL_KEY, "gemma:4b")
    await cache.set(MODE_KEY, "real")
    assert api().delete("/api/data").status_code == 204
    assert await cache.get(MODEL_KEY) is None and await cache.get(MODE_KEY) is None


def test_demo_forced_by_env_is_reported(cache, monkeypatch):
    for flag in ("JOBS_DEMO", "MAIL_DEMO", "CALENDAR_DEMO"):
        monkeypatch.setenv(flag, "true")
    monkeypatch.setenv("LLM_PROVIDER", "demo")
    assert api().get("/api/system/mode").json()["forced_demo"] is True


def test_demo_mode_needs_no_model(cache, monkeypatch):
    def ollama(request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, json={"models": []})

    real_client = httpx.AsyncClient
    main.app.dependency_overrides[system.get_http] = lambda: real_client(
        transport=httpx.MockTransport(ollama)
    )
    client = api()
    assert client.get("/api/system/llm").json()["provider"] == "ollama"
    client.put("/api/system/mode", json={"mode": "demo"})
    assert client.get("/api/system/llm").json()["provider"] == "demo"
    assert client.post("/api/system/llm/test").json()["seconds"] == 0


def test_pull_relays_ollama_progress_line_by_line(cache, monkeypatch):
    seen = {}
    lines = [
        {"status": "pulling manifest"},
        {"status": "downloading", "total": 100, "completed": 40},
        {"status": "success"},
    ]

    def ollama(request: httpx.Request) -> httpx.Response:
        seen.update(path=request.url.path, body=json.loads(request.content))
        return httpx.Response(200, content="\n".join(json.dumps(line) for line in lines).encode())

    mock_services(monkeypatch, ollama)
    response = api().post("/api/system/llm/pull", json={"model": "qwen2.5:7b"})
    assert response.status_code == 200
    assert response.headers["content-type"] == "application/x-ndjson"
    assert [json.loads(line) for line in response.text.splitlines()] == lines
    assert seen == {"path": "/api/pull", "body": {"model": "qwen2.5:7b", "stream": True}}


def test_pull_refuses_a_name_that_is_not_a_model(cache):
    assert api().post("/api/system/llm/pull", json={"model": "; rm -rf /"}).status_code == 422


def test_pull_when_ollama_is_down(cache, monkeypatch):
    def down(request: httpx.Request) -> httpx.Response:
        raise httpx.ConnectError("refused", request=request)

    mock_services(monkeypatch, down)
    response = api().post("/api/system/llm/pull", json={"model": "qwen2.5:7b"})
    assert response.status_code == 503
