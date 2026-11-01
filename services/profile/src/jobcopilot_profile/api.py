from datetime import datetime
from typing import Annotated

from fastapi import APIRouter, Body, Depends, HTTPException, Request, Response, status
from pydantic import BaseModel
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


PHOTO_MAX_BYTES = 2 * 1024 * 1024


def image_type(data: bytes) -> str | None:
    """Le type vient du contenu, pas de ce que déclare le client : SVG et HTML sont refusés."""
    if data.startswith(b"\xff\xd8\xff"):
        return "image/jpeg"
    if data.startswith(b"\x89PNG\r\n\x1a\n"):
        return "image/png"
    if data[:4] == b"RIFF" and data[8:12] == b"WEBP":
        return "image/webp"
    return None


class PhotoInfo(BaseModel):
    updated_at: datetime | None


@router.get("/photo/info", response_model=PhotoInfo)
async def photo_info(session: Session) -> PhotoInfo:
    """Sert à savoir s'il y a une photo, et à changer son adresse quand elle change."""
    row = await repository.get_photo(session)
    return PhotoInfo(updated_at=row.updated_at if row else None)


@router.get("/photo")
async def read_photo(session: Session) -> Response:
    row = await repository.get_photo(session)
    if row is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Aucune photo de profil.")
    return Response(row.data, media_type=row.content_type)


@router.put("/photo", response_model=PhotoInfo)
async def replace_photo(request: Request, session: Session) -> PhotoInfo:
    data = await request.body()
    if len(data) > PHOTO_MAX_BYTES:
        raise HTTPException(
            status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, "Photo trop lourde : 2 Mo au maximum."
        )
    content_type = image_type(data)
    if content_type is None:
        raise HTTPException(
            status.HTTP_415_UNSUPPORTED_MEDIA_TYPE, "Format non pris en charge : JPEG, PNG ou WebP."
        )
    row = await repository.save_photo(session, data, content_type)
    return PhotoInfo(updated_at=row.updated_at)


@router.delete("/photo", status_code=status.HTTP_204_NO_CONTENT)
async def remove_photo(session: Session) -> None:
    await repository.delete_photo(session)


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
