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


async def fetch_offer(client: httpx.AsyncClient, offer_id: int) -> Offer:
    try:
        response = await client.get(f"{get_documents_settings().jobs_url}/offers/{offer_id}")
    except httpx.HTTPError as exc:
        raise UpstreamError("Service des offres injoignable.") from exc
    if response.status_code == 404:
        raise UpstreamError("Offre introuvable.")
    if response.status_code != 200:
        raise UpstreamError("Service des offres indisponible.")
    return Offer.model_validate(response.json())
