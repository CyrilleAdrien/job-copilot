"""Contrat de l'API des offres."""

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict

Seniority = Literal["graduate", "mid", "senior", "lead"]
Contract = Literal["cdi", "cdd", "freelance", "alternance", "stage", "interim"]
Remote = Literal["onsite", "hybrid", "remote", "any"]
MaxAgeDays = Literal[1, 3, 7, 14, 30]
Sort = Literal["date", "relevance"]
MatchMode = Literal["domain", "skills"]


class Criteria(BaseModel):
    """Un profil de recherche lu dans le profil (section `searches`)."""

    model_config = ConfigDict(extra="ignore")

    id: str = "principal"
    name: str = "Principal"
    roles: list[str]
    technologies: list[str] = []
    excluded_keywords: list[str] = []
    seniority: Seniority = "mid"
    contract_types: list[str] = ["cdi"]
    locations: list[str] = []
    radius_km: int = 30
    remote: Remote = "any"
    salary_min: int | None = None
    max_age_days: MaxAgeDays = 7
    match_mode: MatchMode = "domain"
    focus_skills: list[str] = []
    min_skills: int = 2

    @property
    def skills(self) -> list[str]:
        """Compétences recherchées dans les offres : celles choisies, sinon les technologies."""
        return self.focus_skills or self.technologies


class Query(BaseModel):
    """Une requête envoyée à une source : un intitulé, un lieu, une fenêtre de publication."""

    keywords: str
    location: str | None = None
    radius_km: int = 30
    max_age_days: int = 7
    contract_types: list[str] = []


class RawOffer(BaseModel):
    """Offre normalisée telle qu'une source la renvoie, avant stockage."""

    source: str
    external_id: str
    title: str
    company: str | None = None
    location: str | None = None
    contract: Contract | None = None
    salary: str | None = None
    description: str = ""
    url: str
    published_at: datetime


class Offer(BaseModel):
    id: int
    source: str
    title: str
    company: str | None
    location: str | None
    contract: Contract | None
    salary: str | None
    url: str
    published_at: datetime
    snippet: str
    score: int
    matched: list[str]
    remote: Literal["remote", "hybrid"] | None


class OfferDetail(Offer):
    description: str


class OfferList(BaseModel):
    items: list[Offer]
    total: int
    search: str
    hidden: int = 0
    sort: Sort
    max_age_days: int
    refreshed_at: datetime | None


class SourceStatus(BaseModel):
    name: str
    label: str
    status: Literal["ok", "error", "disabled"]
    count: int = 0
    error: str | None = None


class RefreshResult(BaseModel):
    refreshed_at: datetime
    cached: bool = False
    fetched: int
    stored: int
    duplicates: int
    sources: list[SourceStatus]


class SourceInfo(BaseModel):
    name: str
    label: str
    configured: bool
