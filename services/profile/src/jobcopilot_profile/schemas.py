"""Contrat de l'API du profil : c'est aussi le format du fichier profile.yaml."""

import re
import unicodedata
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator

YearMonth = Field(pattern=r"^\d{4}-(0[1-9]|1[0-2])$", examples=["2024-09"])

Seniority = Literal["graduate", "mid", "senior", "lead"]
ContractType = Literal["cdi", "cdd", "freelance", "alternance", "stage"]
RemotePolicy = Literal["onsite", "hybrid", "remote", "any"]
MaxAgeDays = Literal[1, 3, 7, 14, 30]
MatchMode = Literal["domain", "skills"]
OptionalYearMonth = Field(default=None, pattern=r"^\d{4}-(0[1-9]|1[0-2])$")


class Schema(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)


class Link(Schema):
    label: str = Field(min_length=1, max_length=40)
    url: str = Field(min_length=1, max_length=300)


class Identity(Schema):
    full_name: str = Field(min_length=1, max_length=120)
    headline: str = Field(min_length=1, max_length=160, description="Titre affiché sous le nom")
    email: str | None = Field(default=None, pattern=r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
    phone: str | None = Field(default=None, max_length=40)
    location: str | None = Field(default=None, max_length=120)
    availability: str | None = Field(default=None, max_length=120)
    summary: str | None = Field(default=None, max_length=2000)
    links: list[Link] = []


class ExperienceGroup(Schema):
    """Un thème de missions (ex. « Automatisation et CI/CD ») et ses réalisations."""

    title: str | None = Field(default=None, max_length=120)
    bullets: list[str] = Field(default=[], max_length=20)


class Experience(Schema):
    title: str = Field(min_length=1, max_length=160)
    company: str = Field(min_length=1, max_length=160)
    location: str | None = Field(default=None, max_length=120)
    contract: str | None = Field(default=None, max_length=60)
    start: str = YearMonth
    end: str | None = Field(default=None, pattern=r"^\d{4}-(0[1-9]|1[0-2])$")
    context: str | None = Field(default=None, max_length=1000)
    groups: list[ExperienceGroup] = []
    technologies: list[str] = []

    @model_validator(mode="after")
    def end_after_start(self) -> "Experience":
        if self.end is not None and self.end < self.start:
            raise ValueError("la date de fin précède la date de début")
        return self


class Education(Schema):
    degree: str = Field(min_length=1, max_length=200)
    school: str = Field(min_length=1, max_length=160)
    year: int | None = Field(default=None, ge=1950, le=2100)
    details: str | None = Field(default=None, max_length=300)


class SkillCategory(Schema):
    name: str = Field(min_length=1, max_length=80)
    items: list[str] = Field(min_length=1)


class Language(Schema):
    name: str = Field(min_length=1, max_length=40)
    level: str = Field(min_length=1, max_length=60)


class Certification(Schema):
    name: str = Field(min_length=1, max_length=200)
    issuer: str | None = Field(default=None, max_length=120)
    year: int | None = Field(default=None, ge=1950, le=2100)
    url: str | None = Field(default=None, max_length=300)


class Project(Schema):
    name: str = Field(min_length=1, max_length=160)
    description: str | None = Field(default=None, max_length=1000)
    technologies: list[str] = []
    year: int | None = Field(default=None, ge=1950, le=2100)
    url: str | None = Field(default=None, max_length=300)


class Volunteering(Schema):
    role: str = Field(min_length=1, max_length=160)
    organization: str = Field(min_length=1, max_length=160)
    start: str | None = OptionalYearMonth
    end: str | None = OptionalYearMonth
    description: str | None = Field(default=None, max_length=1000)


class Publication(Schema):
    title: str = Field(min_length=1, max_length=300)
    publisher: str | None = Field(default=None, max_length=160)
    year: int | None = Field(default=None, ge=1950, le=2100)
    url: str | None = Field(default=None, max_length=300)


def slugify(text: str) -> str:
    text = unicodedata.normalize("NFKD", text).encode("ascii", "ignore").decode()
    return re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")[:40] or "recherche"


class SearchProfile(Schema):
    """Un profil de recherche (ex. « DevOps », « Data Engineer ») : ses postes et ses filtres."""

    id: str = Field(default="", max_length=40, pattern=r"^[a-z0-9-]*$")
    name: str = Field(min_length=1, max_length=60)
    roles: list[str] = Field(min_length=1, description="Intitulés de poste recherchés")
    technologies: list[str] = []
    excluded_keywords: list[str] = []
    seniority: Seniority = "mid"
    contract_types: list[ContractType] = ["cdi"]
    locations: list[str] = []
    radius_km: int = Field(default=30, ge=0, le=500)
    remote: RemotePolicy = "any"
    salary_min: int | None = Field(default=None, ge=0)
    max_age_days: MaxAgeDays = Field(default=7, description="Ancienneté maximale des offres")
    match_mode: MatchMode = Field(
        default="domain",
        description="domain : toutes les offres du métier ; skills : seulement celles qui citent "
        "assez de compétences choisies",
    )
    focus_skills: list[str] = Field(
        default=[], description="Compétences à faire ressortir (les technologies si vide)"
    )
    min_skills: int = Field(default=2, ge=1, le=10, description="Compétences citées au minimum")


class Profile(Schema):
    identity: Identity
    searches: list[SearchProfile] = Field(min_length=1, max_length=10)
    experiences: list[Experience] = []
    education: list[Education] = []
    skills: list[SkillCategory] = []
    certifications: list[Certification] = []
    projects: list[Project] = []
    volunteering: list[Volunteering] = []
    publications: list[Publication] = []
    languages: list[Language] = []
    soft_skills: list[str] = []
    interests: list[str] = []

    @model_validator(mode="before")
    @classmethod
    def single_search(cls, data: Any) -> Any:
        """Les fichiers d'avant les profils multiples ont une seule section `search`."""
        if isinstance(data, dict) and "search" in data and "searches" not in data:
            data = {**data, "searches": [{"name": "Principal", **(data["search"] or {})}]}
            del data["search"]
        return data

    @model_validator(mode="after")
    def unique_ids(self) -> "Profile":
        """Chaque profil de recherche a un identifiant stable et unique, dérivé de son nom."""
        taken: set[str] = set()
        for search in self.searches:
            base = search.id or slugify(search.name)
            candidate, suffix = base, 2
            while candidate in taken:
                candidate, suffix = f"{base[:36]}-{suffix}", suffix + 1
            search.id = candidate
            taken.add(candidate)
        return self
