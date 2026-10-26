"""Contrat de l'API du profil : c'est aussi le format du fichier profile.yaml."""

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator

YearMonth = Field(pattern=r"^\d{4}-(0[1-9]|1[0-2])$", examples=["2024-09"])

Seniority = Literal["graduate", "mid", "senior", "lead"]
ContractType = Literal["cdi", "cdd", "freelance", "alternance", "stage"]
RemotePolicy = Literal["onsite", "hybrid", "remote", "any"]
MaxAgeDays = Literal[1, 3, 7, 14, 30]


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


class SearchCriteria(Schema):
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


class Profile(Schema):
    identity: Identity
    search: SearchCriteria
    experiences: list[Experience] = []
    education: list[Education] = []
    skills: list[SkillCategory] = []
    languages: list[Language] = []
    soft_skills: list[str] = []
    interests: list[str] = []
