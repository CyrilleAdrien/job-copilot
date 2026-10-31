from datetime import date, datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, model_validator

Status = Literal["draft", "sent", "followed_up", "interview", "offer", "rejected", "withdrawn"]
STATUSES: tuple[Status, ...] = (
    "draft", "sent", "followed_up", "interview", "offer", "rejected", "withdrawn",
)  # fmt: skip
EventSource = Literal["manual", "mail", "system"]


class ApplicationCreate(BaseModel):
    """Depuis une offre (offer_id), ou saisie à la main (title au minimum)."""

    offer_id: int | None = None
    search: str | None = Field(None, description="Profil de recherche d'où vient l'offre")
    title: str | None = Field(None, max_length=300)
    company: str | None = Field(None, max_length=200)
    location: str | None = Field(None, max_length=200)
    url: str | None = Field(None, max_length=1000)
    contact_email: str | None = Field(None, max_length=320)
    notes: str = ""
    status: Status = "draft"

    @model_validator(mode="after")
    def offer_or_title(self) -> "ApplicationCreate":
        if self.offer_id is None and not (self.title or "").strip():
            raise ValueError("Indique l'offre, ou au moins l'intitulé du poste.")
        return self


class ApplicationUpdate(BaseModel):
    """Champs modifiables ; un changement de statut est inscrit à l'historique."""

    status: Status | None = None
    title: str | None = Field(None, min_length=1, max_length=300)
    company: str | None = Field(None, max_length=200)
    location: str | None = Field(None, max_length=200)
    url: str | None = Field(None, max_length=1000)
    contact_email: str | None = Field(None, max_length=320)
    notes: str | None = None
    cv_document_id: UUID | None = None
    letter_document_id: UUID | None = None
    status_source: EventSource = "manual"


class StatusEvent(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    from_status: Status | None
    to_status: Status
    source: EventSource
    created_at: datetime


class ApplicationSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    offer_id: int | None
    search_id: str | None
    title: str
    company: str | None
    location: str | None
    url: str | None
    source: str | None
    contact_email: str | None
    status: Status
    applied_at: datetime | None
    cv_document_id: UUID | None
    letter_document_id: UUID | None
    created_at: datetime
    updated_at: datetime


class Application(ApplicationSummary):
    description: str | None
    notes: str
    events: list[StatusEvent]


class WeekCount(BaseModel):
    week: date = Field(description="Lundi de la semaine")
    sent: int


class FollowUp(BaseModel):
    id: UUID
    title: str
    company: str | None
    status: Status
    contact_email: str | None
    since: datetime = Field(description="Dernier changement de statut")
    days: int


class Stats(BaseModel):
    total: int
    sent: int = Field(description="Candidatures envoyées (date d'envoi renseignée)")
    by_status: dict[Status, int]
    responded: int
    response_rate: float | None = Field(description="Réponses / envoyées, entre 0 et 1")
    average_response_days: float | None
    weekly: list[WeekCount]
    follow_ups: list[FollowUp]
    follow_up_days: int
    computed_at: datetime
