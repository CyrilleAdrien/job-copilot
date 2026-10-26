import asyncio
import os

import httpx
from fastapi import FastAPI, Response, status

SERVICES = ["profile", "jobs", "documents", "applications", "mail", "calendar"]
TIMEOUT = float(os.getenv("CHECK_TIMEOUT", "2.0")) + 2


def service_url(name: str) -> str:
    """URL d'un service, surchargeable par variable d'environnement (ex. PROFILE_URL)."""
    return os.getenv(f"{name.upper()}_URL", f"http://{name}:8000")


async def fetch_ready(client: httpx.AsyncClient, name: str) -> dict:
    try:
        response = await client.get(f"{service_url(name)}/ready")
        return response.json() | {"http_status": response.status_code}
    except httpx.HTTPError as exc:
        return {"service": name, "status": "unreachable", "error": type(exc).__name__}


app = FastAPI(title="job-copilot API", version="0.1.0")


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
