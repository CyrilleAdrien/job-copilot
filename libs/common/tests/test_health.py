import httpx
import pytest

from jobcopilot_common import health
from jobcopilot_common.config import Settings


def mock_http(monkeypatch, status_code: int):
    transport = httpx.MockTransport(lambda request: httpx.Response(status_code))
    real_client = httpx.AsyncClient

    def client(*args, **kwargs):
        return real_client(*args, **kwargs, transport=transport)

    monkeypatch.setattr(health.httpx, "AsyncClient", client)


@pytest.mark.parametrize("status_code", [200, 403])
async def test_s3_is_up_when_it_answers(monkeypatch, status_code):
    mock_http(monkeypatch, status_code)
    await health.check_s3(Settings())


async def test_s3_is_down_on_server_error(monkeypatch):
    mock_http(monkeypatch, 503)
    with pytest.raises(httpx.HTTPStatusError):
        await health.check_s3(Settings())
