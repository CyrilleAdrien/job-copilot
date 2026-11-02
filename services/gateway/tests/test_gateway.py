import io
import json
import zipfile

import httpx
import pytest
from fakeredis import FakeAsyncRedis
from fastapi.testclient import TestClient

from jobcopilot_gateway import main, system


def fake_fetch(down: set[str]):
    async def fetch(_client, name):
        status = "unreachable" if name in down else "ok"
        return {"service": name, "status": status}

    return fetch


def test_health():
    response = TestClient(main.app, base_url="http://localhost").get("/health")
    assert response.status_code == 200
    assert response.json() == {"service": "gateway", "status": "ok"}


def test_ready_aggregates_services(monkeypatch):
    monkeypatch.setattr(main, "fetch_ready", fake_fetch(down=set()))
    response = TestClient(main.app, base_url="http://localhost").get("/ready")
    assert response.status_code == 200
    assert set(response.json()["services"]) == set(main.SERVICES)


def test_ready_degraded_when_a_service_is_down(monkeypatch):
    monkeypatch.setattr(main, "fetch_ready", fake_fetch(down={"mail"}))
    response = TestClient(main.app, base_url="http://localhost").get("/ready")
    assert response.status_code == 503
    assert response.json()["services"]["mail"]["status"] == "unreachable"


async def test_fetch_ready_reports_unreachable_service():
    def refuse(request):
        raise httpx.ConnectError("refused", request=request)

    async with httpx.AsyncClient(transport=httpx.MockTransport(refuse)) as client:
        result = await main.fetch_ready(client, "jobs")
    assert result == {"service": "jobs", "status": "unreachable", "error": "ConnectError"}


def mock_upstream(monkeypatch, handler):
    real_client = httpx.AsyncClient

    def client(*args, **kwargs):
        return real_client(*args, **kwargs, transport=httpx.MockTransport(handler))

    monkeypatch.setattr(main.httpx, "AsyncClient", client)


def test_proxy_forwards_method_path_query_and_body(monkeypatch):
    seen = {}

    def handler(request: httpx.Request) -> httpx.Response:
        seen.update(method=request.method, url=str(request.url), body=request.content)
        return httpx.Response(201, json={"ok": True})

    mock_upstream(monkeypatch, handler)
    response = TestClient(main.app, base_url="http://localhost").put(
        "/api/profile/import?dry=1", content=b"a: 1"
    )
    assert response.status_code == 201
    assert response.json() == {"ok": True}
    assert seen == {"method": "PUT", "url": "http://profile:8000/import?dry=1", "body": b"a: 1"}


def test_proxy_rejects_unknown_service():
    response = TestClient(main.app, base_url="http://localhost").get("/api/billing/")
    assert response.status_code == 404


def test_proxy_reports_unreachable_service(monkeypatch):
    def handler(request: httpx.Request) -> httpx.Response:
        raise httpx.ConnectError("refused", request=request)

    mock_upstream(monkeypatch, handler)
    response = TestClient(main.app, base_url="http://localhost").get("/api/profile/")
    assert response.status_code == 502


def test_proxy_relays_event_streams(monkeypatch):
    body = b"event: progress\ndata: {}\n\nevent: done\ndata: {}\n\n"

    def handler(request: httpx.Request) -> httpx.Response:
        headers = {"content-type": "text/event-stream", "cache-control": "no-cache"}
        return httpx.Response(200, headers=headers, content=body)

    mock_upstream(monkeypatch, handler)
    response = TestClient(main.app, base_url="http://localhost").get(
        "/api/documents/generations/x/events"
    )
    assert response.headers["content-type"] == "text/event-stream"
    assert response.headers["cache-control"] == "no-cache"
    assert response.content == body


LOCAL = "http://localhost"


def test_foreign_host_is_refused_even_for_reads():
    # Une page peut faire pointer son propre domaine sur 127.0.0.1 (DNS rebinding).
    client = TestClient(main.app, base_url="http://evil.example")
    assert client.get("/health").status_code == 403
    assert client.get("/api/profile/").status_code == 403


def test_malformed_host_is_refused_not_a_server_error():
    response = TestClient(main.app, base_url=LOCAL).get("/health", headers={"host": "[bad"})
    assert response.status_code == 403


def test_local_hosts_are_accepted():
    for base in (LOCAL, "http://127.0.0.1:8000", "http://gateway:8000", "http://[::1]:8000"):
        assert TestClient(main.app, base_url=base).get("/health").status_code == 200


def test_writes_from_another_site_are_refused(monkeypatch):
    calls = []

    def handler(request: httpx.Request) -> httpx.Response:
        calls.append(request.url)
        return httpx.Response(204)

    mock_upstream(monkeypatch, handler)
    client = TestClient(main.app, base_url=LOCAL)
    for origin in ("https://evil.example", "https://localhost.evil.example", "null"):
        assert client.delete("/api/data", headers={"origin": origin}).status_code == 403
    assert calls == []
    assert (
        client.delete("/api/data", headers={"origin": "http://localhost:3000"}).status_code == 204
    )


def fake_services(tables=None, fail=(), broken_files=()):
    data = {
        "profile": {"profiles": [], "photos": []},
        "jobs": {"offers": []},
        "documents": {"generations": [], "documents": []},
        "applications": {"applications": []},
        "mail": {"accounts": []},
        "calendar": {"events": []},
    } | (tables or {})
    calls = []

    def handler(request: httpx.Request) -> httpx.Response:
        service, path = request.url.host, request.url.path
        calls.append((request.method, service, path))
        if service in fail:
            raise httpx.ConnectError("refused", request=request)
        if path == "/data":
            return httpx.Response(204)
        if path == "/data/export":
            return httpx.Response(200, json=data[service])
        if path in broken_files:
            return httpx.Response(500)
        if path == "/export":
            return httpx.Response(200, text="identity: {}")
        if path == "/photo":
            return httpx.Response(200, content=b"img", headers={"content-type": "image/png"})
        if path.endswith("/pdf"):
            return httpx.Response(200, content=b"%PDF-1.7")
        return httpx.Response(404)

    return handler, calls


def read_export(response):
    with zipfile.ZipFile(io.BytesIO(response.content)) as archive:
        return {name.split("/", 1)[1]: archive.read(name) for name in archive.namelist()}


FULL = {
    "profile": {"profiles": [{"id": 1}], "photos": [{"id": 1}]},
    "documents": {"generations": [], "documents": [{"id": "d1", "kind": "cv"}]},
}


def test_export_gathers_every_service_and_file(monkeypatch):
    handler, _ = fake_services(FULL)
    mock_upstream(monkeypatch, handler)
    response = TestClient(main.app, base_url=LOCAL).get("/api/data/export")
    assert response.status_code == 200
    assert response.headers["content-type"] == "application/zip"
    assert 'filename="job-copilot-' in response.headers["content-disposition"]
    files = read_export(response)
    for service in main.SERVICES:
        assert f"{service}.json" in files
    assert files["profile.yaml"] == b"identity: {}"
    assert files["photo.png"] == b"img"
    assert files["documents/cv-d1.pdf"] == b"%PDF-1.7"
    manifest = json.loads(files["manifest.json"])
    assert manifest["services"]["profile"] == {"profiles": 1, "photos": 1}
    assert manifest["missing"] == []


def test_export_lists_unreadable_files_instead_of_hiding_them(monkeypatch):
    handler, _ = fake_services(FULL, broken_files=("/documents/d1/pdf",))
    mock_upstream(monkeypatch, handler)
    files = read_export(TestClient(main.app, base_url=LOCAL).get("/api/data/export"))
    assert "documents/cv-d1.pdf" not in files
    assert json.loads(files["manifest.json"])["missing"] == ["documents/cv-d1.pdf"]


def test_export_fails_rather_than_being_silently_partial(monkeypatch):
    handler, _ = fake_services(fail=("mail",))
    mock_upstream(monkeypatch, handler)
    response = TestClient(main.app, base_url=LOCAL).get("/api/data/export")
    assert response.status_code == 502
    assert "mail" in response.json()["detail"]


def test_erase_calls_every_service(monkeypatch):
    handler, calls = fake_services()
    mock_upstream(monkeypatch, handler)
    assert TestClient(main.app, base_url=LOCAL).delete("/api/data").status_code == 204
    assert sorted(calls) == sorted(("DELETE", name, "/data") for name in main.SERVICES)


def test_erase_names_the_service_that_failed_and_still_erases_the_others(monkeypatch):
    handler, calls = fake_services(fail=("calendar",))
    mock_upstream(monkeypatch, handler)
    response = TestClient(main.app, base_url=LOCAL).delete("/api/data")
    assert response.status_code == 502
    assert "calendar" in response.json()["detail"]
    assert len(calls) == len(main.SERVICES)


class Tags:
    def __init__(self, models=("qwen2.5:7b", "gemma:4b"), up=True, chat=None):
        self.models, self.up, self.chat, self.payloads = models, up, chat, []

    def __call__(self, request: httpx.Request) -> httpx.Response:
        if not self.up:
            raise httpx.ConnectError("refused", request=request)
        if request.url.path == "/api/tags":
            return httpx.Response(
                200, json={"models": [{"name": name, "size": 4_000} for name in self.models]}
            )
        self.payloads.append(json.loads(request.content))
        return self.chat or httpx.Response(200, json={"message": {"content": '{"ok": true}'}})


@pytest.fixture
def ollama(monkeypatch):
    tags = Tags()
    cache = FakeAsyncRedis(decode_responses=True)
    real_client = httpx.AsyncClient

    def mocked(**kwargs):
        return real_client(transport=httpx.MockTransport(tags), **kwargs)

    monkeypatch.setattr(system.httpx, "AsyncClient", mocked)
    monkeypatch.setenv("LLM_PROVIDER", "ollama")
    main.app.dependency_overrides[system.get_cache] = lambda: cache
    main.app.dependency_overrides[system.get_http] = lambda: real_client(
        transport=httpx.MockTransport(tags)
    )
    yield tags
    main.app.dependency_overrides.clear()


def api():
    return TestClient(main.app, base_url="http://localhost")


def test_llm_state_lists_installed_models(ollama):
    state = api().get("/api/system/llm").json()
    assert state["reachable"] is True and state["model_installed"] is True
    assert state["model"] == state["default_model"] == "qwen2.5:7b"
    assert [item["name"] for item in state["installed"]] == ["qwen2.5:7b", "gemma:4b"]


def test_llm_state_when_ollama_is_down_is_an_answer_not_an_error(ollama):
    ollama.up = False
    response = api().get("/api/system/llm")
    assert response.status_code == 200
    assert response.json()["reachable"] is False and response.json()["installed"] == []


def test_choosing_a_model_is_used_by_the_next_call(ollama):
    client = api()
    assert client.put("/api/system/llm", json={"model": "gemma:4b"}).json()["model"] == "gemma:4b"
    assert client.get("/api/system/llm").json()["model"] == "gemma:4b"
    tested = client.post("/api/system/llm/test")
    assert tested.status_code == 200 and tested.json()["model"] == "gemma:4b"
    assert ollama.payloads[0]["model"] == "gemma:4b"


def test_a_model_that_is_not_installed_is_refused(ollama):
    client = api()
    response = client.put("/api/system/llm", json={"model": "absent:1b"})
    assert response.status_code == 409 and "ollama pull absent:1b" in response.json()["detail"]
    assert client.get("/api/system/llm").json()["model"] == "qwen2.5:7b"


def test_choosing_a_model_needs_ollama(ollama):
    ollama.up = False
    assert api().put("/api/system/llm", json={"model": "gemma:4b"}).status_code == 503


def test_llm_test_reports_the_reason_of_a_failure(ollama):
    ollama.chat = httpx.Response(404)
    response = api().post("/api/system/llm/test")
    assert response.status_code == 503 and "n'est pas installé" in response.json()["detail"]


def test_llm_test_in_demo_mode_needs_no_model(ollama, monkeypatch):
    monkeypatch.setenv("LLM_PROVIDER", "demo")
    response = api().post("/api/system/llm/test")
    assert response.status_code == 200 and response.json()["seconds"] == 0
    assert ollama.payloads == []


def test_system_status_is_an_answer_even_when_degraded(monkeypatch):
    monkeypatch.setattr(main, "fetch_ready", fake_fetch(down={"mail"}))
    response = api().get("/api/system/status")
    assert response.status_code == 200 and response.json()["status"] == "degraded"
