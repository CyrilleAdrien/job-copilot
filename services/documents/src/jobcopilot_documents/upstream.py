"""Lecture du profil et de l'offre auprès des services profile et jobs."""

import httpx

from jobcopilot_documents.schemas import Offer, Profile
from jobcopilot_documents.settings import get_documents_settings


class UpstreamError(Exception):
    pass


async def fetch_profile(client: httpx.AsyncClient) -> Profile:
    try:
        response = await client.get(f"{get_documents_settings().profile_url}/")
    except httpx.HTTPError as exc:
        raise UpstreamError("Service profil injoignable.") from exc
    if response.status_code == 404:
        raise UpstreamError("Configure ton profil avant de générer un CV.")
    if response.status_code != 200:
        raise UpstreamError("Service profil indisponible.")
    return Profile.model_validate(response.json())


def is_image(data: bytes) -> bool:
    return data.startswith((b"\xff\xd8\xff", b"\x89PNG\r\n\x1a\n")) or (
        data[:4] == b"RIFF" and data[8:12] == b"WEBP"
    )


async def fetch_photo(client: httpx.AsyncClient) -> bytes | None:
    """La photo de profil. Facultative : absente ou illisible, le CV reste valable."""
    try:
        response = await client.get(f"{get_documents_settings().profile_url}/photo")
    except httpx.HTTPError:
        return None
    if response.status_code != 200 or not is_image(response.content):
        return None
    return response.content


async def fetch_offer(client: httpx.AsyncClient, offer_id: int, search: str | None = None) -> Offer:
    params = {"search": search} if search else {}
    try:
        response = await client.get(
            f"{get_documents_settings().jobs_url}/offers/{offer_id}", params=params
        )
    except httpx.HTTPError as exc:
        raise UpstreamError("Service des offres injoignable.") from exc
    if response.status_code == 404:
        raise UpstreamError("Offre introuvable.")
    if response.status_code != 200:
        raise UpstreamError("Service des offres indisponible.")
    return Offer.model_validate(response.json())
