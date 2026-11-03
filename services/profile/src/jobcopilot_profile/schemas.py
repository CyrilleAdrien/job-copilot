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
    """Ce qui est commun à toutes les recherches."""

    full_name: str = Field(min_length=1, max_length=120)
    email: str | None = Field(default=None, pattern=r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
    phone: str | None = Field(default=None, max_length=40)
    location: str | None = Field(default=None, max_length=120)
    address: str | None = Field(default=None, max_length=200)
    birth_date: str | None = Field(
        default=None, pattern=r"^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$"
    )
    nationality: str | None = Field(default=None, max_length=60)
    driving_licence: str | None = Field(
        default=None, max_length=40, description="Catégories, ex. B"
    )
    availability: str | None = Field(default=None, max_length=120)
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
    location: str | None = Field(default=None, max_length=120)
    start: str | None = OptionalYearMonth
    end: str | None = OptionalYearMonth
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


class Award(Schema):
    title: str = Field(min_length=1, max_length=200)
    issuer: str | None = Field(default=None, max_length=160)
    year: int | None = Field(default=None, ge=1950, le=2100)
    description: str | None = Field(default=None, max_length=1000)


class Course(Schema):
    name: str = Field(min_length=1, max_length=200)
    institution: str | None = Field(default=None, max_length=160)
    year: int | None = Field(default=None, ge=1950, le=2100)


class Referee(Schema):
    name: str = Field(min_length=1, max_length=120)
    role: str | None = Field(default=None, max_length=160)
    company: str | None = Field(default=None, max_length=160)
    email: str | None = Field(default=None, pattern=r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
    phone: str | None = Field(default=None, max_length=40)


class CustomSection(Schema):
    """Une section libre du CV, pour ce qu'aucune autre ne couvre."""

    title: str = Field(min_length=1, max_length=80)
    items: list[str] = Field(default=[], max_length=30)


class SearchCv(Schema):
    """Le CV d'une recherche : deux recherches peuvent viser des métiers sans rapport."""

    headline: str = Field(default="", max_length=160, description="Titre affiché sous le nom")
    summary: str | None = Field(default=None, max_length=2000)
    experiences: list[Experience] = []
    education: list[Education] = []
    skills: list[SkillCategory] = []
    certifications: list[Certification] = []
    projects: list[Project] = []
    volunteering: list[Volunteering] = []
    publications: list[Publication] = []
    awards: list[Award] = []
    courses: list[Course] = []
    referees: list[Referee] = []
    custom_sections: list[CustomSection] = []
    soft_skills: list[str] = []
    interests: list[str] = []


CV_SECTIONS = tuple(name for name in SearchCv.model_fields if name not in ("headline", "summary"))


class SectionLabel(Schema):
    """Le nom donné à une rubrique, par langue du CV. Vide : le nom par défaut."""

    fr: str | None = Field(default=None, max_length=80)
    en: str | None = Field(default=None, max_length=80)


# Facultatifs sur un CV : affichés seulement si la personne le demande.
HIDDEN_BY_DEFAULT = ["address", "birth_date", "nationality", "referees"]


HexColor = Field(default=None, pattern=r"^#[0-9A-Fa-f]{6}$")


class CvColors(Schema):
    """Les couleurs du CV et de la lettre. Vide : celles par défaut."""

    background: str | None = HexColor
    text: str | None = HexColor
    rule: str | None = HexColor


class CvLayout(Schema):
    """L'affichage du CV d'une recherche : ne change que le rendu, jamais le contenu."""

    hidden: list[str] = Field(default_factory=lambda: list(HIDDEN_BY_DEFAULT), max_length=60)
    order: list[str] = Field(default=[], max_length=40)
    labels: dict[str, SectionLabel] = {}
    font: str | None = Field(
        default=None, max_length=60, description="Police du CV et de la lettre"
    )
    colors: CvColors | None = None


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
    archived: bool = Field(default=False, description="Masquée de l'écran Offres, gardée au profil")
    primary: bool = Field(default=False, description="Son CV est celui de la page Profil")
    cv: SearchCv = Field(default_factory=SearchCv)
    cv_layout: CvLayout = Field(default_factory=CvLayout)


class Profile(Schema):
    identity: Identity
    searches: list[SearchProfile] = Field(min_length=1, max_length=10)
    languages: list[Language] = []

    @model_validator(mode="before")
    @classmethod
    def older_files(cls, data: Any) -> Any:
        """Les anciens fichiers : une section `search`, ou un CV commun à toutes les recherches."""
        if not isinstance(data, dict):
            return data
        data = dict(data)
        if "search" in data and "searches" not in data:
            data["searches"] = [{"name": "Principal", **(data.pop("search") or {})}]
        cv = {name: data.pop(name) for name in CV_SECTIONS if name in data}
        if isinstance(data.get("identity"), dict):
            identity = dict(data["identity"])
            cv |= {name: identity.pop(name) for name in ("headline", "summary") if name in identity}
            data["identity"] = identity
        if cv and isinstance(data.get("searches"), list):
            data["searches"] = [
                {"cv": cv, **search} if isinstance(search, dict) else search
                for search in data["searches"]
            ]
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

    @model_validator(mode="after")
    def one_active_search(self) -> "Profile":
        if all(search.archived for search in self.searches):
            raise ValueError("Garde au moins une recherche active.")
        return self

    @model_validator(mode="after")
    def one_primary_search(self) -> "Profile":
        """Toujours une seule recherche principale, active : la première active par défaut."""
        active = [search for search in self.searches if not search.archived]
        chosen = next((search for search in active if search.primary), active[0])
        for search in self.searches:
            search.primary = search is chosen
        return self
