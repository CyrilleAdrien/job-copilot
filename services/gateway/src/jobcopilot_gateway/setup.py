"""Mode de l'application, choisi dans l'assistant de premier lancement.

- `real` : l'utilisateur configure ses propres sources, sa boîte et son calendrier.
- `demo` : profil d'exemple, offres, réponses et calendrier fictifs, sans LLM.

Passer de la démonstration au mode réel demande d'effacer les données (DELETE /api/data),
pour ne pas mélanger des candidatures fictives aux vraies.
"""

import os
from pathlib import Path

import httpx
from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel
from redis.exceptions import RedisError

from jobcopilot_common.mode import MODE_KEY, Mode, read_mode
from jobcopilot_gateway import system
from jobcopilot_gateway.data import service_url

TIMEOUT = 60.0
# À la racine du dépôt, copié dans l'image (voir services/Dockerfile).
EXAMPLE_PROFILE = Path(__file__).resolve().parents[4] / "examples" / "profile.example.yaml"

router = APIRouter(prefix="/api/system", tags=["setup"])


class ModeState(BaseModel):
    mode: Mode | None
    # Démonstration imposée par .env (stack de test) : l'assistant ne propose pas d'en sortir.
    forced_demo: bool


class ModeChoice(BaseModel):
    mode: Mode


def forced_demo() -> bool:
    flags = ("JOBS_DEMO", "MAIL_DEMO", "CALENDAR_DEMO")
    return os.getenv("LLM_PROVIDER") == "demo" and all(
        os.getenv(flag, "").lower() == "true" for flag in flags
    )


async def mode_state() -> ModeState:
    return ModeState(mode=await read_mode(system.get_cache()), forced_demo=forced_demo())


async def save_mode(mode: Mode) -> None:
    try:
        await system.get_cache().set(MODE_KEY, mode)
    except (RedisError, OSError) as exc:
        raise HTTPException(
            status.HTTP_503_SERVICE_UNAVAILABLE, "Choix non enregistré : Redis ne répond pas."
        ) from exc


@router.get("/mode", response_model=ModeState)
async def get_mode() -> ModeState:
    return await mode_state()


@router.put("/mode", response_model=ModeState)
async def choose_mode(choice: ModeChoice) -> ModeState:
    current = await read_mode(system.get_cache())
    if current == "demo" and choice.mode == "real":
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            "Quitter la démonstration efface ses données : passe par « Quitter la démo ».",
        )
    await save_mode(choice.mode)
    return await mode_state()


async def call(client: httpx.AsyncClient, step: str, method: str, url: str, **kwargs):
    """Un appel à un service ; une panne dit quelle étape de la démonstration a échoué."""
    try:
        response = await client.request(method, url, **kwargs)
    except httpx.HTTPError as exc:
        raise HTTPException(status.HTTP_502_BAD_GATEWAY, f"{step} : service injoignable.") from exc
    if response.is_error:
        raise HTTPException(status.HTTP_502_BAD_GATEWAY, f"{step} : erreur {response.status_code}.")
    return response


@router.post("/demo", response_model=ModeState)
async def start_demo() -> ModeState:
    """Tout prêt en un clic : profil d'exemple, boîte et calendrier fictifs, premières offres.

    Ce qui existe déjà est gardé, si bien que l'appel peut être relancé après une panne.
    """
    await save_mode("demo")
    async with httpx.AsyncClient(timeout=TIMEOUT) as client:
        profile = service_url("profile")
        found = await client.get(f"{profile}/")
        if found.status_code == 404:
            await call(
                client,
                "Profil d'exemple",
                "POST",
                f"{profile}/import",
                content=EXAMPLE_PROFILE.read_bytes(),
                headers={"content-type": "application/yaml"},
            )

        mail = service_url("mail")
        mailboxes = await call(client, "Boîte mail", "GET", f"{mail}/accounts")
        if not mailboxes.json():
            await call(
                client,
                "Boîte mail",
                "POST",
                f"{mail}/accounts",
                json={"email": "alex.martin@exemple.fr", "host": "demo", "password": "demo"},
            )

        calendar = service_url("calendar")
        calendars = await call(client, "Calendrier", "GET", f"{calendar}/accounts")
        if not calendars.json():
            await call(
                client,
                "Calendrier",
                "POST",
                f"{calendar}/accounts",
                json={
                    "provider": "demo",
                    "url": "demo",
                    "username": "demo",
                    "password": "demo",
                    "calendar_url": "demo/entretiens",
                    "calendar_name": "Entretiens",
                },
            )

        await call(
            client, "Offres", "POST", f"{service_url('jobs')}/refresh", params={"force": "true"}
        )
    return await mode_state()
