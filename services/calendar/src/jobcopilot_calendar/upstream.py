"""Échanges avec le service applications : titre de la candidature et changement de statut."""

import httpx

from jobcopilot_calendar.settings import get_calendar_settings

# Un entretien ou un test planifié fait avancer la candidature, jamais reculer.
FORWARD = {
    "technical_test": {"sent", "followed_up"},
    "interview": {"sent", "followed_up", "technical_test"},
}


class UpstreamError(Exception):
    pass


async def get_application(client: httpx.AsyncClient, application_id: str) -> dict | None:
    url = f"{get_calendar_settings().applications_url}/applications/{application_id}"
    try:
        response = await client.get(url)
    except httpx.HTTPError as exc:
        raise UpstreamError("Service des candidatures injoignable.") from exc
    if response.status_code == 404:
        return None
    if response.status_code != 200:
        raise UpstreamError("Service des candidatures indisponible.")
    return response.json()


async def advance_status(client: httpx.AsyncClient, application: dict, kind: str) -> bool:
    """Passe la candidature à Entretien ou Test technique si c'est un pas en avant."""
    if application["status"] not in FORWARD.get(kind, set()):
        return False
    url = f"{get_calendar_settings().applications_url}/applications/{application['id']}"
    try:
        response = await client.patch(url, json={"status": kind, "status_source": "manual"})
    except httpx.HTTPError as exc:
        raise UpstreamError("Service des candidatures injoignable.") from exc
    if response.status_code != 200:
        raise UpstreamError(f"Statut non modifié ({response.status_code}).")
    return True
