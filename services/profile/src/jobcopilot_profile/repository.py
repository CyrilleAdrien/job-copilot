from sqlalchemy import delete
from sqlalchemy.ext.asyncio import AsyncSession

from jobcopilot_profile.models import ExperienceRow, ProfileRow, SearchCriteriaRow
from jobcopilot_profile.schemas import Profile

PROFILE_ID = 1

IDENTITY_FIELDS = ("full_name", "headline", "email", "phone", "location", "availability", "summary")
LIST_FIELDS = ("education", "skills", "languages", "soft_skills", "interests")


async def get_profile(session: AsyncSession) -> Profile | None:
    row = await session.get(ProfileRow, PROFILE_ID)
    if row is None:
        return None
    return Profile.model_validate(
        {
            "identity": {field: getattr(row, field) for field in IDENTITY_FIELDS}
            | {"links": row.links},
            "search": {
                column.key: getattr(row.search, column.key)
                for column in SearchCriteriaRow.__table__.columns
                if column.key != "profile_id"
            },
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
    if row.search is None:
        row.search = SearchCriteriaRow(**data["search"])
    else:
        for field, value in data["search"].items():
            setattr(row.search, field, value)

    await session.commit()
    await session.refresh(row)
    saved = await get_profile(session)
    assert saved is not None
    return saved


async def delete_profile(session: AsyncSession) -> bool:
    result = await session.execute(delete(ProfileRow).where(ProfileRow.id == PROFILE_ID))
    await session.commit()
    return result.rowcount > 0
