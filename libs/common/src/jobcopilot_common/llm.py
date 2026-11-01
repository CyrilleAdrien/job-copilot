"""Accès au LLM partagé par les services : Ollama en local, sortie JSON validée par Pydantic."""

from typing import Protocol

import httpx
from pydantic import BaseModel, ValidationError
from redis.asyncio import Redis
from redis.exceptions import RedisError

from jobcopilot_common.config import Settings

# Modèle choisi dans les réglages. Vide ou Redis absent : OLLAMA_MODEL de .env.
MODEL_KEY = "llm:model"


class LLMError(Exception):
    """Le modèle est injoignable ou sa réponse ne respecte pas le schéma attendu."""


class LLM(Protocol):
    model: str

    async def complete[T: BaseModel](self, system: str, prompt: str, schema: type[T]) -> T: ...


class Ollama:
    """Client de l'API /api/chat d'Ollama, contraint par le schéma JSON de la réponse attendue."""

    def __init__(
        self,
        settings: Settings,
        client: httpx.AsyncClient | None = None,
        cache: Redis | None = None,
    ):
        self.cache = cache
        self.url = settings.ollama_url
        self.model = settings.ollama_model
        self.timeout = settings.llm_timeout
        self.context = settings.llm_context
        # Sur processeur, un 7B peut mettre plusieurs minutes à répondre.
        self.client = client or httpx.AsyncClient(
            timeout=httpx.Timeout(settings.llm_timeout, connect=10.0)
        )

    async def current_model(self) -> str:
        if self.cache is None:
            return self.model
        try:
            return await self.cache.get(MODEL_KEY) or self.model
        except (RedisError, OSError):
            return self.model

    async def complete[T: BaseModel](self, system: str, prompt: str, schema: type[T]) -> T:
        model = await self.current_model()
        payload = {
            "model": model,
            "messages": [
                {"role": "system", "content": system},
                {"role": "user", "content": prompt},
            ],
            "format": schema.model_json_schema(),
            "stream": False,
            # Fenêtre assez large pour l'offre et le profil (Ollama tronque au-delà, sans le dire),
            # et modèle gardé en mémoire entre les appels d'une même génération.
            "options": {"temperature": 0.2, "num_ctx": self.context},
            "keep_alive": "30m",
        }
        last_error: Exception | None = None
        # Un modèle 7B sort parfois un JSON incomplet : un second essai suffit en pratique.
        for _ in range(2):
            try:
                response = await self.client.post(f"{self.url}/api/chat", json=payload)
            except httpx.TimeoutException as exc:
                raise LLMError(
                    f"Le modèle n'a pas répondu en {self.timeout:.0f} s. Sur processeur, augmente "
                    "LLM_TIMEOUT ou essaie un modèle plus léger (OLLAMA_MODEL)."
                ) from exc
            except httpx.ConnectError as exc:
                raise LLMError("Ollama est injoignable : vérifie que le conteneur tourne.") from exc
            except httpx.HTTPError as exc:
                raise LLMError(
                    "Ollama s'est arrêté pendant la génération, souvent faute de mémoire : "
                    "un modèle 7B demande environ 6 Go libres pour Docker."
                ) from exc
            if response.status_code == 404:
                raise LLMError(f"Le modèle {model} n'est pas installé : lance `make models`.")
            if response.status_code != 200:
                raise LLMError(f"Ollama a répondu {response.status_code}.")
            try:
                return schema.model_validate_json(response.json()["message"]["content"])
            except (ValidationError, KeyError, ValueError) as exc:
                last_error = exc
        raise LLMError("La réponse du modèle ne respecte pas le format attendu.") from last_error

    async def available(self) -> bool:
        """Vrai si Ollama répond et que le modèle configuré est téléchargé."""
        try:
            response = await self.client.get(f"{self.url}/api/tags")
            names = {model["name"] for model in response.json().get("models", [])}
        except (httpx.HTTPError, ValueError, KeyError):
            return False
        model = await self.current_model()
        return model in names or f"{model}:latest" in names
