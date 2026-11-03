"""Contrats du service : entrées (profil, offre), contenu des documents, réponses du LLM, API."""

from datetime import datetime
from typing import Annotated, Literal
from uuid import UUID

from pydantic import AfterValidator, BaseModel, ConfigDict, Field

Language = Literal["fr", "en"]
Kind = Literal["cv", "letter"]


class Loose(BaseModel):
    model_config = ConfigDict(extra="ignore")


# Profil et offre, tels que les services profile et jobs les renvoient.


class Link(Loose):
    label: str
    url: str


class Identity(Loose):
    full_name: str
    headline: str
    email: str | None = None
    phone: str | None = None
    location: str | None = None
    address: str | None = None
    birth_date: str | None = None
    nationality: str | None = None
    driving_licence: str | None = None
    availability: str | None = None
    summary: str | None = None
    links: list[Link] = []


class Group(BaseModel):
    title: str | None = None
    bullets: list[str] = []


class Experience(Loose):
    title: str
    company: str
    location: str | None = None
    contract: str | None = None
    start: str
    end: str | None = None
    context: str | None = None
    groups: list[Group] = []
    technologies: list[str] = []


class Education(Loose):
    degree: str
    school: str
    year: int | None = None
    location: str | None = None
    start: str | None = None
    end: str | None = None
    details: str | None = None


class SkillCategory(BaseModel):
    name: str
    items: list[str]


class SpokenLanguage(Loose):
    name: str
    level: str


# Les polices embarquées, et le nom à donner à Word : celui de la police payante qu'elle remplace
# quand elle en a les dimensions, le sien sinon.
FONTS = {
    "Carlito": "Calibri",
    "Arimo": "Arial",
    "Tinos": "Times New Roman",
    "Caladea": "Cambria",
    "Gelasio": "Georgia",
    "EB Garamond": "Garamond",
    "Roboto": "Roboto",
    "Open Sans": "Open Sans",
    "Lato": "Lato",
    "Montserrat": "Montserrat",
}


class CvLayout(Loose):
    """L'affichage du CV choisi par la personne. Ne contient aucun texte du CV."""

    hidden: list[str] = ["address", "birth_date", "nationality", "referees"]
    order: list[str] = []
    labels: dict[str, dict[str, str | None]] = {}
    font: str | None = None


class Search(Loose):
    id: str = "principal"
    contract_types: list[str] = []
    archived: bool = False
    primary: bool = False
    cv_layout: CvLayout = Field(default_factory=CvLayout)


class Certification(Loose):
    name: str
    issuer: str | None = None
    year: int | None = None
    url: str | None = None


class Project(Loose):
    name: str
    description: str | None = None
    technologies: list[str] = []
    year: int | None = None
    url: str | None = None


class Volunteering(Loose):
    role: str
    organization: str
    start: str | None = None
    end: str | None = None
    description: str | None = None


class Publication(Loose):
    title: str
    publisher: str | None = None
    year: int | None = None
    url: str | None = None


class Award(Loose):
    title: str
    issuer: str | None = None
    year: int | None = None
    description: str | None = None


class Course(Loose):
    name: str
    institution: str | None = None
    year: int | None = None


class Referee(Loose):
    name: str
    role: str | None = None
    company: str | None = None
    email: str | None = None
    phone: str | None = None


class CustomSection(Loose):
    title: str
    items: list[str] = []


class Profile(Loose):
    identity: Identity
    searches: list[Search] = []
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
    languages: list[SpokenLanguage] = []
    soft_skills: list[str] = []
    interests: list[str] = []


class Offer(Loose):
    id: int
    title: str
    company: str | None = None
    location: str | None = None
    contract: str | None = None
    url: str
    description: str = ""
    matched: list[str] = []


# Contenu rendu par les templates Typst. Il est modifiable avant validation.


class CvExperience(BaseModel):
    title: str
    company: str
    location: str | None = None
    period: str
    context: str | None = None
    groups: list[Group] = []


class CvEducation(BaseModel):
    degree: str
    school: str
    year: int | None = None
    period: str | None = None
    location: str | None = None
    details: str | None = None


class ContactItem(BaseModel):
    text: str
    url: str | None = None
    kind: str | None = Field(default=None, description="Choisit l'icône affichée par le template")


class LabeledLine(BaseModel):
    key: str | None = Field(default=None, description="Sa clé dans `hidden` et `titles`")
    label: str
    text: str


def known_font(value: str | None) -> str | None:
    """Une police inconnue, venue d'un ancien fichier par exemple, revient à celle par défaut."""
    return value if value in FONTS else None


class CvEntry(BaseModel):
    """Une ligne d'une section secondaire : certification, projet, bénévolat, publication."""

    title: str
    meta: list[str] = []
    text: str | None = None
    url: str | None = None


class CvSection(BaseModel):
    key: str | None = Field(default=None, description="Sa clé dans `order`, `hidden` et `titles`")
    title: str
    entries: list[CvEntry] = []
    bullets: list[str] = []


class CvContent(BaseModel):
    language: Language
    name: str
    headline: str
    show_photo: bool = Field(
        default=False, description="La photo est lue au rendu, pas stockée ici"
    )
    contact: list[ContactItem] = []
    details: list[str] = []
    highlight: str | None = None
    summary: str | None = None
    skills: list[SkillCategory] = []
    experiences: list[CvExperience] = []
    education: list[CvEducation] = []
    sections: list[CvSection] = []
    extras: list[LabeledLine] = []
    order: list[str] = Field(default=[], description="Ordre des rubriques ; vide : ordre classique")
    titles: dict[str, str] = Field(default={}, description="Noms choisis par la personne")
    hidden: list[str] = Field(default=[], description="Gardé dans le contenu, absent du rendu")
    font: Annotated[str | None, AfterValidator(known_font)] = None


class LetterContent(BaseModel):
    language: Language
    sender: list[str]
    headline: str | None = None
    contact: list[ContactItem] = []
    font: Annotated[str | None, AfterValidator(known_font)] = None
    recipient: list[str]
    place_date: str
    subject: str
    greeting: str
    paragraphs: list[str] = Field(min_length=1)
    closing: str
    signature: str


# Réponses attendues du LLM : courtes, contraintes par leur schéma JSON.


class Selection(BaseModel):
    requirements: list[str] = Field(description="Exigences clés de l'offre, 8 au plus")
    experience_indexes: list[int] = Field(description="Numéros des expériences à garder")


class DraftExperience(BaseModel):
    index: int
    groups: list[Group]


class CvDraft(BaseModel):
    headline: str
    summary: str
    experiences: list[DraftExperience]


class LetterDraft(BaseModel):
    subject: str
    greeting: str
    paragraphs: list[str]
    closing: str


# API


class GenerationRequest(BaseModel):
    offer_id: int
    search: str | None = Field(
        default=None, description="Profil de recherche d'où vient l'offre (le premier sinon)"
    )
    letter: bool = True
    language: Language | None = Field(
        default=None, description="Détectée depuis l'offre si absente"
    )


class Warning(BaseModel):
    kind: Kind
    text: str
    reason: str


class DocumentInfo(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    kind: Kind
    language: Language
    version: int
    pages: int
    created_at: datetime


class Step(BaseModel):
    key: str
    label: str
    state: Literal["pending", "running", "done", "error"]


class Generation(BaseModel):
    id: UUID
    offer_id: int
    offer_title: str | None
    company: str | None
    language: Language | None
    status: Literal["running", "done", "error"]
    steps: list[Step]
    error: str | None
    warnings: list[Warning]
    documents: list[DocumentInfo]
    created_at: datetime


class DocumentPreview(BaseModel):
    pages: list[str] = Field(description="Une image PNG par page, en base64")


class DocumentDetail(DocumentInfo):
    content: dict


class ProfilePreview(BaseModel):
    pages: int


class LLMStatus(BaseModel):
    provider: str
    model: str
    ready: bool
