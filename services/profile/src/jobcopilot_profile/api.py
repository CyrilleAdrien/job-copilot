from typing import Annotated

from fastapi import APIRouter, Body, Depends, HTTPException, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from jobcopilot_common.db import get_session
from jobcopilot_profile import repository
from jobcopilot_profile.schemas import Profile
from jobcopilot_profile.yaml_io import ProfileFileError, dump_profile, load_profile

router = APIRouter(tags=["profile"])
Session = Annotated[AsyncSession, Depends(get_session)]


@router.get("/", response_model=Profile)
async def read_profile(session: Session) -> Profile:
    profile = await repository.get_profile(session)
    if profile is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Aucun profil configuré.")
    return profile


@router.put("/", response_model=Profile)
async def replace_profile(profile: Profile, session: Session) -> Profile:
    return await repository.save_profile(session, profile)


@router.delete("/", status_code=status.HTTP_204_NO_CONTENT)
async def remove_profile(session: Session) -> None:
    if not await repository.delete_profile(session):
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Aucun profil configuré.")


NO_SEARCH = "Recherche introuvable."
LAST_SEARCH = "Garde au moins une recherche active : crée-en une autre avant."


async def change_search(action) -> Profile:
    try:
        return await action
    except repository.SearchNotFound as exc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, NO_SEARCH) from exc
    except repository.LastSearch as exc:
        raise HTTPException(status.HTTP_409_CONFLICT, LAST_SEARCH) from exc


@router.post("/searches/{search_id}/archive", response_model=Profile)
async def archive_search(search_id: str, session: Session) -> Profile:
    """Masque la recherche de l'écran Offres sans la perdre."""
    return await change_search(repository.update_search(session, search_id, archived=True))


@router.post("/searches/{search_id}/restore", response_model=Profile)
async def restore_search(search_id: str, session: Session) -> Profile:
    return await change_search(repository.update_search(session, search_id, archived=False))


@router.delete("/searches/{search_id}", response_model=Profile)
async def delete_search(search_id: str, session: Session) -> Profile:
    return await change_search(repository.delete_search(session, search_id))


@router.get("/export")
async def export_profile(session: Session) -> Response:
    profile = await repository.get_profile(session)
    if profile is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Aucun profil configuré.")
    return Response(
        dump_profile(profile),
        media_type="application/yaml",
        headers={"Content-Disposition": 'attachment; filename="profile.yaml"'},
    )


@router.post("/import", response_model=Profile)
async def import_profile(
    session: Session,
    content: Annotated[str, Body(media_type="application/yaml", max_length=200_000)],
) -> Profile:
    try:
        profile = load_profile(content)
    except ProfileFileError as exc:
        raise HTTPException(422, {"message": str(exc), "errors": exc.errors}) from exc
    return await repository.save_profile(session, profile)
