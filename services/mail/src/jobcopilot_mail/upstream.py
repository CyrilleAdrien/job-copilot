"""Échanges avec le service applications : liste des candidatures et changement de statut."""

import httpx

from jobcopilot_mail.matching import Candidate
from jobcopilot_mail.settings import get_mail_settings


class UpstreamError(Exception):
    pass


async def list_candidates(client: httpx.AsyncClient) -> list[Candidate]:
    try:
        response = await client.get(f"{get_mail_settings().applications_url}/applications")
    except httpx.HTTPError as exc:
        raise UpstreamError("Service des candidatures injoignable.") from exc
    if response.status_code != 200:
        raise UpstreamError("Service des candidatures indisponible.")
    return [
        Candidate(
            id=item["id"],
            title=item["title"],
            company=item.get("company"),
            contact_email=item.get("contact_email"),
            status=item["status"],
            applied_at=item.get("applied_at"),
        )
        for item in response.json()
    ]


async def profile_name(client: httpx.AsyncClient) -> str | None:
    """Le nom affiché dans les mails. Sans profil, le mail part avec l'adresse seule."""
    try:
        response = await client.get(f"{get_mail_settings().profile_url}/")
        if response.status_code == 200:
            return response.json()["identity"]["full_name"]
    except (httpx.HTTPError, ValueError, KeyError, TypeError):
        pass
    return None


async def set_status(client: httpx.AsyncClient, application_id: str, status: str) -> None:
    url = f"{get_mail_settings().applications_url}/applications/{application_id}"
    try:
        response = await client.patch(url, json={"status": status, "status_source": "mail"})
    except httpx.HTTPError as exc:
        raise UpstreamError("Service des candidatures injoignable.") from exc
    if response.status_code != 200:
        raise UpstreamError(f"Statut non modifié ({response.status_code}).")
