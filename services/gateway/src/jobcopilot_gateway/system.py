"""Modèle Ollama utilisé par tous les services : état, choix et test."""

import asyncio
import os
import time
from functools import lru_cache
from typing import Annotated

import httpx
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from redis.asyncio import Redis
from redis.exceptions import RedisError

from jobcopilot_common import get_settings
from jobcopilot_common.llm import MODEL_KEY, LLMError, Ollama

TAGS_TIMEOUT = 5.0
# Sous le délai du relais web : l'erreur affichée reste la nôtre.
TEST_TIMEOUT = 55.0

router = APIRouter(prefix="/api/system", tags=["system"])


class ModelInfo(BaseModel):
    name: str
    size: int = 0


class LLMState(BaseModel):
    provider: str
    url: str
    model: str
    default_model: str
    reachable: bool
    model_installed: bool
    installed: list[ModelInfo]


class ModelChoice(BaseModel):
    model: str = Field(min_length=1, max_length=200)


class LLMTest(BaseModel):
    model: str
    seconds: float


class Ping(BaseModel):
    ok: bool


@lru_cache
def get_cache() -> Redis:
    return Redis.from_url(get_settings().redis_url, decode_responses=True)


@lru_cache
def get_http() -> httpx.AsyncClient:
    return httpx.AsyncClient(timeout=TAGS_TIMEOUT)


Cache = Annotated[Redis, Depends(get_cache)]
Http = Annotated[httpx.AsyncClient, Depends(get_http)]


def provider() -> str:
    return os.getenv("LLM_PROVIDER", "ollama")


async def installed_models(http: httpx.AsyncClient) -> list[ModelInfo] | None:
    """Les modèles téléchargés, ou None si Ollama ne répond pas."""
    try:
        response = await http.get(f"{get_settings().ollama_url}/api/tags")
        response.raise_for_status()
        return [
            ModelInfo(name=item["name"], size=item.get("size", 0))
            for item in response.json().get("models", [])
        ]
    except (httpx.HTTPError, ValueError, KeyError, TypeError):
        return None


def is_installed(model: str, models: list[ModelInfo]) -> bool:
    names = {item.name for item in models}
    return model in names or f"{model}:latest" in names


@router.get("/llm", response_model=LLMState)
async def llm_state(cache: Cache, http: Http) -> LLMState:
    settings = get_settings()
    model = await Ollama(settings, http, cache).current_model()
    models = await installed_models(http)
    return LLMState(
        provider=provider(),
        url=settings.ollama_url,
        model=model,
        default_model=settings.ollama_model,
        reachable=models is not None,
        model_installed=models is not None and is_installed(model, models),
        installed=models or [],
    )


@router.put("/llm", response_model=LLMState)
async def choose_model(choice: ModelChoice, cache: Cache, http: Http) -> LLMState:
    """Le choix vaut pour tous les services dès le prochain appel, sans redémarrage."""
    models = await installed_models(http)
    if models is None:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, "Ollama ne répond pas.")
    if not is_installed(choice.model, models):
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            f"Le modèle {choice.model} n'est pas installé : lance `ollama pull {choice.model}`.",
        )
    try:
        await cache.set(MODEL_KEY, choice.model)
    except RedisError as exc:
        raise HTTPException(
            status.HTTP_503_SERVICE_UNAVAILABLE, "Choix non enregistré : Redis ne répond pas."
        ) from exc
    return await llm_state(cache, http)


@router.post("/llm/test", response_model=LLMTest)
async def test_model(cache: Cache) -> LLMTest:
    """Une vraie réponse du modèle, chronométrée. Le premier appel le charge en mémoire."""
    if provider() == "demo":
        return LLMTest(model="démonstration", seconds=0)
    settings = get_settings()
    async with httpx.AsyncClient(timeout=TEST_TIMEOUT) as client:
        llm = Ollama(settings, client, cache)
        started = time.monotonic()
        try:
            async with asyncio.timeout(TEST_TIMEOUT):
                await llm.complete('Réponds en JSON : {"ok": true}.', "Es-tu prêt ?", Ping)
        except TimeoutError as exc:
            raise HTTPException(
                status.HTTP_503_SERVICE_UNAVAILABLE,
                f"Le modèle n'a pas répondu en {TEST_TIMEOUT:.0f} s. Réessaie, ou choisis un "
                "modèle plus léger.",
            ) from exc
        except LLMError as exc:
            raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, str(exc)) from exc
        return LLMTest(model=await llm.current_model(), seconds=time.monotonic() - started)
