"""Accès au LLM partagé par les services : Ollama en local, sortie JSON validée par Pydantic."""

from typing import Protocol

import httpx
from pydantic import BaseModel, ValidationError

from jobcopilot_common.config import Settings


class LLMError(Exception):
    """Le modèle est injoignable ou sa réponse ne respecte pas le schéma attendu."""


class LLM(Protocol):
    model: str

    async def complete[T: BaseModel](self, system: str, prompt: str, schema: type[T]) -> T: ...


class Ollama:
    """Client de l'API /api/chat d'Ollama, contraint par le schéma JSON de la réponse attendue."""

    def __init__(self, settings: Settings, client: httpx.AsyncClient | None = None):
        self.url = settings.ollama_url
        self.model = settings.ollama_model
        self.client = client or httpx.AsyncClient(timeout=settings.llm_timeout)

    async def complete[T: BaseModel](self, system: str, prompt: str, schema: type[T]) -> T:
        payload = {
            "model": self.model,
            "messages": [
                {"role": "system", "content": system},
                {"role": "user", "content": prompt},
            ],
            "format": schema.model_json_schema(),
            "stream": False,
            "options": {"temperature": 0.2},
        }
        last_error: Exception | None = None
        # Un modèle 7B sort parfois un JSON incomplet : un second essai suffit en pratique.
        for _ in range(2):
            try:
                response = await self.client.post(f"{self.url}/api/chat", json=payload)
            except httpx.HTTPError as exc:
                raise LLMError("Ollama est injoignable.") from exc
            if response.status_code == 404:
                raise LLMError(f"Le modèle {self.model} n'est pas installé : lance `make models`.")
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
        return self.model in names or f"{self.model}:latest" in names
