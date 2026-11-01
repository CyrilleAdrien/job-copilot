from datetime import UTC, datetime

from sqlalchemy import delete
from sqlalchemy.ext.asyncio import AsyncSession

from jobcopilot_profile.models import ExperienceRow, PhotoRow, ProfileRow
from jobcopilot_profile.schemas import Profile

PROFILE_ID = 1

IDENTITY_FIELDS = ("full_name", "headline", "email", "phone", "location", "availability", "summary")
LIST_FIELDS = (
    "searches",
    "education",
    "skills",
    "certifications",
    "projects",
    "volunteering",
    "publications",
    "languages",
    "soft_skills",
    "interests",
)


async def get_profile(session: AsyncSession) -> Profile | None:
    row = await session.get(ProfileRow, PROFILE_ID)
    if row is None:
        return None
    return Profile.model_validate(
        {
            "identity": {field: getattr(row, field) for field in IDENTITY_FIELDS}
            | {"links": row.links},
            "experiences": [
                {
                    "title": e.title,
                    "company": e.company,
                    "location": e.location,
                    "contract": e.contract,
                    "start": e.start,
                    "end": e.end,
                    "context": e.context,
                    "groups": e.groups,
                    "technologies": e.technologies,
                }
                for e in row.experiences
            ],
        }
        | {field: getattr(row, field) for field in LIST_FIELDS}
    )


async def save_profile(session: AsyncSession, profile: Profile) -> Profile:
    """Remplace le profil entier : le formulaire et l'import YAML envoient toujours tout."""
    data = profile.model_dump(mode="json")
    row = await session.get(ProfileRow, PROFILE_ID)
    if row is None:
        row = ProfileRow(id=PROFILE_ID)
        session.add(row)

    identity = data["identity"]
    for field in IDENTITY_FIELDS:
        setattr(row, field, identity[field])
    row.links = identity["links"]
    for field in LIST_FIELDS:
        setattr(row, field, data[field])

    row.experiences = [
        ExperienceRow(position=index, **experience)
        for index, experience in enumerate(data["experiences"])
    ]

    await session.commit()
    await session.refresh(row)
    saved = await get_profile(session)
    assert saved is not None
    return saved


async def delete_profile(session: AsyncSession) -> bool:
    result = await session.execute(delete(ProfileRow).where(ProfileRow.id == PROFILE_ID))
    await session.execute(delete(PhotoRow))
    await session.commit()
    return result.rowcount > 0


async def get_photo(session: AsyncSession) -> PhotoRow | None:
    return await session.get(PhotoRow, PROFILE_ID)


async def save_photo(session: AsyncSession, data: bytes, content_type: str) -> PhotoRow:
    row = await get_photo(session)
    if row is None:
        row = PhotoRow(id=PROFILE_ID)
        session.add(row)
    row.data, row.content_type, row.updated_at = data, content_type, datetime.now(UTC)
    await session.commit()
    return row


async def delete_photo(session: AsyncSession) -> None:
    await session.execute(delete(PhotoRow))
    await session.commit()


class SearchNotFound(LookupError):
    pass


class LastSearch(ValueError):
    """Un profil garde toujours au moins une recherche active."""


async def update_search(session: AsyncSession, search_id: str, *, archived: bool) -> Profile:
    profile = await get_profile(session)
    if profile is None or not any(search.id == search_id for search in profile.searches):
        raise SearchNotFound
    active = [
        search for search in profile.searches if not search.archived and search.id != search_id
    ]
    if archived and not active:
        raise LastSearch
    for search in profile.searches:
        if search.id == search_id:
            search.archived = archived
    return await save_profile(session, profile)


async def delete_search(session: AsyncSession, search_id: str) -> Profile:
    profile = await get_profile(session)
    if profile is None or not any(search.id == search_id for search in profile.searches):
        raise SearchNotFound
    remaining = [search for search in profile.searches if search.id != search_id]
    if not any(not search.archived for search in remaining):
        raise LastSearch
    profile.searches = remaining
    return await save_profile(session, profile)
