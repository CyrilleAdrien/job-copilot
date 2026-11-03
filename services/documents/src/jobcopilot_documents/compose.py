"""Assemble le contenu du CV et de la lettre à partir du profil et des propositions du LLM."""

import re
from datetime import date
from urllib.parse import urlparse

from jobcopilot_documents.schemas import (
    ContactItem,
    CvContent,
    CvDraft,
    CvEducation,
    CvEntry,
    CvExperience,
    CvSection,
    Experience,
    LabeledLine,
    Language,
    LetterContent,
    LetterDraft,
    Offer,
    Profile,
)

CONTRACTS = {
    "cdi": "CDI",
    "cdd": "CDD",
    "freelance": "Freelance",
    "alternance": "Alternance",
    "stage": "Stage",
}
MONTHS = {
    "fr": [
        "janvier", "février", "mars", "avril", "mai", "juin",
        "juillet", "août", "septembre", "octobre", "novembre", "décembre",
    ],
    "en": [
        "January", "February", "March", "April", "May", "June",
        "July", "August", "September", "October", "November", "December",
    ],
}  # fmt: skip
WORDS = {
    "fr": {
        "now": "aujourd'hui",
        "soft": "Qualités",
        "languages": "Langues",
        "interests": "Centres d'intérêt",
        "licence": "Permis",
        "courses": "Formations suivies",
        "awards": "Récompenses",
        "projects": "Projets",
        "certifications": "Certifications",
        "volunteering": "Bénévolat",
        "publications": "Publications",
    },
    "en": {
        "now": "present",
        "soft": "Soft skills",
        "languages": "Languages",
        "interests": "Interests",
        "licence": "Driving licence",
        "courses": "Courses",
        "awards": "Awards",
        "projects": "Projects",
        "certifications": "Certifications",
        "volunteering": "Volunteering",
        "publications": "Publications",
    },
}


def period(start: str, end: str | None, language: Language) -> str:
    def month(value: str) -> str:
        year, number = value.split("-")
        return f"{number}/{year}"

    return f"{month(start)} – {month(end) if end else WORDS[language]['now']}"


def link_kind(url: str) -> str:
    host = urlparse(url).hostname or ""
    for site in ("github", "linkedin"):
        if host == f"{site}.com" or host.endswith(f".{site}.com"):
            return site
    return "link"


def contact(profile: Profile, language: Language) -> list[ContactItem]:
    """Les coordonnées de l'en-tête. L'adresse complète n'y figure pas par défaut."""
    identity = profile.identity
    items = []
    if identity.location:
        items.append(ContactItem(text=identity.location, kind="location"))
    if identity.email:
        items.append(ContactItem(text=identity.email, url=f"mailto:{identity.email}", kind="email"))
    if identity.phone:
        number = identity.phone.replace(" ", "")
        items.append(ContactItem(text=identity.phone, url=f"tel:{number}", kind="phone"))
    for link in identity.links:
        web = link.url.lower().startswith(("http://", "https://"))
        items.append(
            ContactItem(
                text=link.label,
                url=link.url if web else None,
                kind=link_kind(link.url) if web else "link",
            )
        )
    if identity.driving_licence:
        label = f"{WORDS[language]['licence']} {identity.driving_licence}"
        items.append(ContactItem(text=label, kind="licence"))
    return items


def education_period(start: str | None, end: str | None) -> str | None:
    def month(value: str) -> str:
        year, number = value.split("-")
        return f"{number}/{year}"

    return " – ".join(month(value) for value in (start, end) if value) or None


def experience(source: Experience, language: Language, groups=None) -> CvExperience:
    title = f"{source.title} ({source.contract})" if source.contract else source.title
    return CvExperience(
        title=title,
        company=source.company,
        location=source.location,
        period=period(source.start, source.end, language),
        context=source.context,
        groups=groups if groups is not None else source.groups,
    )


def present(*values: str | int | None) -> list[str]:
    """Les valeurs renseignées, en texte : « CNCF », « 2025 »."""
    return [str(value) for value in values if value]


def sections(profile: Profile, language: Language) -> list[CvSection]:
    """Sections secondaires, reprises du profil telles quelles, dans l'ordre d'un CV."""
    words = WORDS[language]
    found = [
        (
            words["projects"],
            [
                CvEntry(
                    title=item.name,
                    meta=present(", ".join(item.technologies), item.year),
                    text=item.description,
                    url=item.url,
                )
                for item in profile.projects
            ],
        ),
        (
            words["certifications"],
            [
                CvEntry(title=item.name, meta=present(item.issuer, item.year), url=item.url)
                for item in profile.certifications
            ],
        ),
        (
            words["volunteering"],
            [
                CvEntry(
                    title=item.role,
                    meta=present(
                        item.organization, item.start and period(item.start, item.end, language)
                    ),
                    text=item.description,
                )
                for item in profile.volunteering
            ],
        ),
        (
            words["publications"],
            [
                CvEntry(title=item.title, meta=present(item.publisher, item.year), url=item.url)
                for item in profile.publications
            ],
        ),
        (
            words["courses"],
            [
                CvEntry(title=item.name, meta=present(item.institution, item.year))
                for item in profile.courses
            ],
        ),
        (
            words["awards"],
            [
                CvEntry(
                    title=item.title,
                    meta=present(item.issuer, item.year),
                    text=item.description,
                )
                for item in profile.awards
            ],
        ),
    ]
    result = [CvSection(title=title, entries=entries) for title, entries in found if entries]
    result += [
        CvSection(title=item.title, bullets=item.items)
        for item in profile.custom_sections
        if item.items
    ]
    return result


def contract_types(profile: Profile, search: str | None) -> list[str]:
    chosen = next((item for item in profile.searches if item.id == search), None)
    chosen = chosen or (profile.searches[0] if profile.searches else None)
    return chosen.contract_types if chosen else []


def build_cv(
    profile: Profile,
    selected: list[int],
    draft: CvDraft | None,
    language: Language,
    search: str | None = None,
) -> CvContent:
    """CV ciblé : expériences retenues, dans l'ordre du profil, avec les missions reformulées."""
    identity = profile.identity
    rewritten = {item.index: item.groups for item in draft.experiences} if draft else {}
    experiences = [
        experience(source, language, rewritten.get(index) or None)
        for index, source in enumerate(profile.experiences)
        if index in selected
    ]
    words = WORDS[language]
    spoken = ", ".join(f"{item.name} – {item.level}" for item in profile.languages)
    lines = (
        (words["languages"], spoken),
        (words["soft"], ", ".join(profile.soft_skills)),
        (words["interests"], ", ".join(profile.interests)),
    )
    extras = [LabeledLine(label=label, text=text) for label, text in lines if text]

    details = [CONTRACTS.get(c, c) for c in contract_types(profile, search)[:2]]
    return CvContent(
        language=language,
        name=identity.full_name,
        headline=(draft.headline if draft else None) or identity.headline,
        show_photo=True,
        contact=contact(profile, language),
        details=details,
        highlight=identity.availability,
        summary=(draft.summary if draft else None) or identity.summary,
        skills=profile.skills,
        experiences=experiences,
        education=[
            CvEducation(
                degree=item.degree,
                school=item.school,
                year=item.year,
                period=education_period(item.start, item.end),
                location=item.location,
                details=item.details,
            )
            for item in profile.education
        ],
        sections=sections(profile, language),
        extras=extras,
    )


def place_date(place: str | None, language: Language, today: date) -> str:
    month = MONTHS[language][today.month - 1]
    if language == "fr":
        day = "1er" if today.day == 1 else str(today.day)
        written = f"le {day} {month} {today.year}"
        return f"{place}, {written}" if place else written.capitalize()
    written = f"{month} {today.day}, {today.year}"
    return f"{place}, {written}" if place else written


def build_letter(
    profile: Profile, offer: Offer, draft: LetterDraft, language: Language, today: date
) -> LetterContent:
    identity = profile.identity
    city = re.split(r"[/,]", identity.location)[0].strip() if identity.location else None
    sender = [identity.full_name]
    sender += [value for value in (identity.location, identity.phone, identity.email) if value]
    recipient = [value for value in (offer.company, offer.location) if value]
    return LetterContent(
        language=language,
        sender=sender,
        headline=identity.headline,
        contact=contact(profile, language),
        recipient=recipient,
        place_date=place_date(city, language, today),
        subject=draft.subject,
        greeting=draft.greeting,
        paragraphs=draft.paragraphs,
        closing=draft.closing,
        signature=identity.full_name,
    )
