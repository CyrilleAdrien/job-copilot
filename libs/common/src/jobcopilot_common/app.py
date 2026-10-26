from collections.abc import Callable
from contextlib import AbstractAsyncContextManager

from fastapi import FastAPI, Response, status

from jobcopilot_common import health
from jobcopilot_common.config import get_settings


def create_service_app(
    name: str,
    dependencies: list[str],
    lifespan: Callable[[FastAPI], AbstractAsyncContextManager[None]] | None = None,
) -> FastAPI:
    """Crée l'application FastAPI d'un service avec /health (vivant) et /ready (dépendances)."""
    unknown = set(dependencies) - health.CHECKS.keys()
    if unknown:
        raise ValueError(f"Dépendances inconnues : {sorted(unknown)}")

    app = FastAPI(title=f"job-copilot {name}", version="0.1.0", lifespan=lifespan)

    @app.get("/health", tags=["health"])
    async def liveness() -> dict[str, str]:
        return {"service": name, "status": "ok"}

    @app.get("/ready", tags=["health"])
    async def readiness(response: Response) -> dict:
        checks = await health.run_checks(dependencies, get_settings())
        ready = all(result == "ok" for result in checks.values())
        if not ready:
            response.status_code = status.HTTP_503_SERVICE_UNAVAILABLE
        return {"service": name, "status": "ok" if ready else "degraded", "checks": checks}

    return app
