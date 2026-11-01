import asyncio
import os

import httpx
from fastapi import FastAPI, HTTPException, Request, Response, status
from fastapi.responses import StreamingResponse
from starlette.background import BackgroundTask

from jobcopilot_gateway import data
from jobcopilot_gateway.data import SERVICES, service_url
from jobcopilot_gateway.guard import LocalOnly

TIMEOUT = float(os.getenv("CHECK_TIMEOUT", "2.0")) + 2
PROXY_TIMEOUT = 60.0
FORWARDED_HEADERS = ("content-type", "accept")
RETURNED_HEADERS = ("content-type", "content-disposition", "cache-control")


async def fetch_ready(client: httpx.AsyncClient, name: str) -> dict:
    try:
        response = await client.get(f"{service_url(name)}/ready")
        return response.json() | {"http_status": response.status_code}
    except httpx.HTTPError as exc:
        return {"service": name, "status": "unreachable", "error": type(exc).__name__}


app = FastAPI(title="job-copilot API", version="0.1.0")
app.add_middleware(LocalOnly)
# Avant le relais générique, dont le motif /api/{service}/{path} couvrirait /api/data/export.
app.include_router(data.router)


@app.get("/health", tags=["health"])
async def liveness() -> dict[str, str]:
    return {"service": "gateway", "status": "ok"}


@app.get("/ready", tags=["health"])
async def readiness(response: Response) -> dict:
    """État de tous les services et de leurs dépendances, en un seul appel."""
    async with httpx.AsyncClient(timeout=TIMEOUT) as client:
        results = await asyncio.gather(*(fetch_ready(client, name) for name in SERVICES))
    services = {name: result for name, result in zip(SERVICES, results, strict=True)}
    ready = all(result["status"] == "ok" for result in services.values())
    if not ready:
        response.status_code = status.HTTP_503_SERVICE_UNAVAILABLE
    return {"status": "ok" if ready else "degraded", "services": services}


@app.api_route(
    "/api/{service}/{path:path}",
    methods=["GET", "POST", "PUT", "PATCH", "DELETE"],
    tags=["proxy"],
)
async def proxy(service: str, path: str, request: Request) -> Response:
    """Transmet /api/<service>/<chemin> au service, qui reste invisible depuis l'extérieur.

    La réponse est relayée au fil de l'eau : les flux SSE (progression d'une génération)
    arrivent au navigateur sans attendre la fin.
    """
    if service not in SERVICES:
        raise HTTPException(status.HTTP_404_NOT_FOUND, f"Service inconnu : {service}")
    headers = {key: request.headers[key] for key in FORWARDED_HEADERS if key in request.headers}
    client = httpx.AsyncClient(timeout=PROXY_TIMEOUT)
    upstream_request = client.build_request(
        request.method,
        f"{service_url(service)}/{path}",
        params=request.query_params,
        content=await request.body(),
        headers=headers,
    )
    try:
        upstream = await client.send(upstream_request, stream=True)
    except httpx.HTTPError as exc:
        await client.aclose()
        raise HTTPException(
            status.HTTP_502_BAD_GATEWAY, f"Le service {service} ne répond pas."
        ) from exc

    async def close() -> None:
        await upstream.aclose()
        await client.aclose()

    return StreamingResponse(
        upstream.aiter_bytes(),
        status_code=upstream.status_code,
        headers={key: upstream.headers[key] for key in RETURNED_HEADERS if key in upstream.headers},
        background=BackgroundTask(close),
    )
