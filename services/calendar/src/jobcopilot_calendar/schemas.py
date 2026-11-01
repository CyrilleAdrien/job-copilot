from datetime import datetime
from typing import Literal
from urllib.parse import urlsplit
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

Kind = Literal["interview", "technical_test", "follow_up", "other"]


class HelpLink(BaseModel):
    label: str
    url: str


class Provider(BaseModel):
    id: str
    label: str
    url: str
    help: str
    steps: list[str] = []
    links: list[HelpLink] = []
    # Google refuse les mots de passe d'application en CalDAV : lien ou import par événement.
    caldav: bool = True


class Credentials(BaseModel):
    provider: str = Field(max_length=40)
    url: str = Field(max_length=500)
    username: str = Field(min_length=1, max_length=320)
    password: str = Field("", max_length=500)

    @field_validator("url")
    @classmethod
    def no_credentials_in_url(cls, url: str) -> str:
        # L'URL est stockée et affichée en clair : seul le champ mot de passe est chiffré.
        if "@" in urlsplit(url).netloc:
            raise ValueError("L'identifiant et le mot de passe ont leurs propres champs.")
        return url


class RemoteCalendarOut(BaseModel):
    url: str
    name: str


class AccountCreate(Credentials):
    calendar_url: str = Field(min_length=1, max_length=1000)
    calendar_name: str = Field("Calendrier", max_length=200)


class Account(BaseModel):
    """Jamais de mot de passe dans une réponse."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    provider: str
    url: str
    username: str
    calendar_name: str
    last_sync_at: datetime | None
    last_error: str | None
    created_at: datetime


class EventFields(BaseModel):
    kind: Kind = "interview"
    title: str = Field(min_length=1, max_length=300)
    starts_at: datetime
    ends_at: datetime
    location: str = Field("", max_length=300)
    video_url: str = Field("", max_length=1000)
    notes: str = Field("", max_length=5000)

    @model_validator(mode="after")
    def ends_after_start(self):
        if self.ends_at <= self.starts_at:
            raise ValueError("La fin doit être après le début.")
        if self.starts_at.tzinfo is None:
            raise ValueError("Indique le fuseau horaire de la date (ISO 8601 avec décalage).")
        return self


class EventCreate(EventFields):
    application_id: UUID | None = None
    # Fait avancer la candidature à Entretien ou Test technique (jamais en arrière).
    advance_status: bool = True


class EventUpdate(BaseModel):
    kind: Kind | None = None
    title: str | None = Field(None, min_length=1, max_length=300)
    starts_at: datetime | None = None
    ends_at: datetime | None = None
    location: str | None = Field(None, max_length=300)
    video_url: str | None = Field(None, max_length=1000)
    notes: str | None = Field(None, max_length=5000)
    application_id: UUID | None = None


class Event(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    application_id: UUID | None
    kind: Kind
    title: str
    starts_at: datetime
    ends_at: datetime
    location: str
    video_url: str
    notes: str
    synced_at: datetime | None
    sync_error: str | None
    created_at: datetime
    updated_at: datetime
    # Renseigné à la création : la candidature est passée à Entretien ou Test technique.
    status_changed: bool = False


class SyncReport(BaseModel):
    pushed: int
    errors: list[str]
