"""Lecture de l'offre (service jobs) et de ses documents (service documents)."""

import re
from uuid import UUID

import httpx

from jobcopilot_applications.settings import get_applications_settings

EMAIL = re.compile(r"[\w.+-]+@[\w-]+(?:\.[\w-]+)*\.[a-z]{2,}", re.IGNORECASE)
NO_REPLY = ("noreply", "no-reply", "nepasrepondre", "ne-pas-repondre", "donotreply")


class UpstreamError(Exception):
    def __init__(self, message: str, status_code: int = 502):
        super().__init__(message)
        self.status_code = status_code


def contact_email(text: str | None) -> str | None:
    """Première adresse de contact citée dans l'offre, hors adresses de non-réponse."""
    for found in EMAIL.findall(text or ""):
        if not any(marker in found.lower() for marker in NO_REPLY):
            return found.rstrip(".")
    return None


async def fetch_offer(client: httpx.AsyncClient, offer_id: int, search: str | None) -> dict:
    params = {"search": search} if search else {}
    url = f"{get_applications_settings().jobs_url}/offers/{offer_id}"
    try:
        response = await client.get(url, params=params)
    except httpx.HTTPError as exc:
        raise UpstreamError("Service des offres injoignable.") from exc
    if response.status_code == 404:
        raise UpstreamError("Offre introuvable.", 404)
    if response.status_code != 200:
        raise UpstreamError("Service des offres indisponible.")
    return response.json()


async def latest_documents(client: httpx.AsyncClient, offer_id: int) -> dict[str, UUID]:
    """CV et lettre de la dernière génération réussie pour l'offre. Vide si aucune."""
    url = f"{get_applications_settings().documents_url}/generations"
    try:
        response = await client.get(url, params={"offer_id": offer_id, "limit": 10})
    except httpx.HTTPError:
        return {}
    if response.status_code != 200:
        return {}
    for generation in response.json():
        if generation["status"] != "done":
            continue
        documents: dict[str, UUID] = {}
        for document in sorted(generation["documents"], key=lambda doc: doc["version"]):
            documents[document["kind"]] = UUID(document["id"])
        return documents
    return {}
