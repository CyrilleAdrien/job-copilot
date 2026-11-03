"""Assemble le contenu du CV et de la lettre à partir du profil et des propositions du LLM."""

import re
from collections.abc import Collection
from datetime import date
from urllib.parse import urlparse

from jobcopilot_documents.schemas import (
    ContactItem,
    CvContent,
    CvDraft,
    CvEducation,
    CvEntry,
    CvExperience,
    CvLayout,
    CvSection,
    Experience,
    LabeledLine,
    Language,
    LetterContent,
    LetterDraft,
    Offer,
    Profile,
    Search,
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
        "referees": "Références",
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
        "referees": "References",
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


# Les rubriques du CV, dans leur ordre classique. Les sections libres se placent avant « extras ».
DEFAULT_ORDER = (
    "profile",
    "skills",
    "experience",
    "education",
    "projects",
    "certifications",
    "volunteering",
    "publications",
    "courses",
    "awards",
    "referees",
)


def link_kind(url: str) -> str:
    host = urlparse(url).hostname or ""
    for site in ("github", "linkedin"):
        if host == f"{site}.com" or host.endswith(f".{site}.com"):
            return site
    return "link"


def birth_date(value: str, language: Language) -> str:
    year, month, day = (int(part) for part in value.split("-"))
    if language == "fr":
        return f"{'1er' if day == 1 else day} {MONTHS['fr'][month - 1]} {year}"
    return f"{MONTHS['en'][month - 1]} {day}, {year}"


def contact(profile: Profile, language: Language) -> list[ContactItem]:
    """Toutes les coordonnées. Ce qui est masqué ne disparaît qu'au rendu : voir `visible_cv`."""
    identity = profile.identity
    items = []
    if identity.address:
        items.append(ContactItem(text=identity.address, kind="address"))
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
    if identity.birth_date:
        items.append(ContactItem(text=birth_date(identity.birth_date, language), kind="birth"))
    if identity.nationality:
        items.append(ContactItem(text=identity.nationality, kind="nationality"))
    return items


# La clé qui masque une coordonnée, quand elle diffère de son type.
CONTACT_KEYS = {"github": "links", "linkedin": "links", "link": "links", "birth": "birth_date"}


def visible_contact(items: list[ContactItem], hidden: Collection[str]) -> list[ContactItem]:
    return [item for item in items if CONTACT_KEYS.get(item.kind, item.kind) not in hidden]


def visible_cv(cv: CvContent) -> CvContent:
    """Ce qui s'affiche : le PDF et le Word partent de là, le contenu complet reste enregistré."""
    hidden, titles = cv.hidden, cv.titles
    if not hidden and not titles:
        return cv
    return cv.model_copy(
        update={
            "show_photo": cv.show_photo and "photo" not in hidden,
            "contact": visible_contact(cv.contact, hidden),
            "details": [] if "contracts" in hidden else cv.details,
            "highlight": None if "availability" in hidden else cv.highlight,
            "summary": None if "profile" in hidden else cv.summary,
            "skills": [] if "skills" in hidden else cv.skills,
            "experiences": [] if "experience" in hidden else cv.experiences,
            "education": [] if "education" in hidden else cv.education,
            "sections": [
                part.model_copy(update={"title": titles.get(part.key, part.title)})
                for part in cv.sections
                if part.key not in hidden
            ],
            "extras": [
                line.model_copy(update={"label": titles.get(line.key, line.label)})
                for line in cv.extras
                if line.key not in hidden
            ],
        }
    )


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
    """Sections secondaires, reprises du profil telles quelles."""
    words = WORDS[language]
    found = [
        (
            "projects",
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
            "certifications",
            [
                CvEntry(title=item.name, meta=present(item.issuer, item.year), url=item.url)
                for item in profile.certifications
            ],
        ),
        (
            "volunteering",
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
            "publications",
            [
                CvEntry(title=item.title, meta=present(item.publisher, item.year), url=item.url)
                for item in profile.publications
            ],
        ),
        (
            "courses",
            [
                CvEntry(title=item.name, meta=present(item.institution, item.year))
                for item in profile.courses
            ],
        ),
        (
            "awards",
            [
                CvEntry(
                    title=item.title,
                    meta=present(item.issuer, item.year),
                    text=item.description,
                )
                for item in profile.awards
            ],
        ),
        (
            "referees",
            [
                CvEntry(
                    title=item.name, meta=present(item.role, item.company, item.email, item.phone)
                )
                for item in profile.referees
            ],
        ),
    ]
    result = [
        CvSection(key=key, title=words[key], entries=entries) for key, entries in found if entries
    ]
    result += [
        CvSection(key=f"custom:{item.title}", title=item.title, bullets=item.items)
        for item in profile.custom_sections
        if item.items
    ]
    return result


def chosen_search(profile: Profile, search: str | None) -> Search | None:
    """La recherche demandée, sinon la principale, sinon la première active."""
    found = next((item for item in profile.searches if item.id == search), None)
    active = [item for item in profile.searches if not item.archived]
    main = next((item for item in active if item.primary), None)
    return found or main or next(iter(active or profile.searches), None)


def contract_types(profile: Profile, search: str | None) -> list[str]:
    chosen = chosen_search(profile, search)
    return chosen.contract_types if chosen else []


def section_order(layout: CvLayout, section_list: list[CvSection]) -> list[str]:
    """L'ordre choisi, complété par les rubriques absentes : aucune ne peut disparaître."""
    keys = [
        *DEFAULT_ORDER,
        *(item.key for item in section_list if item.key and item.key not in DEFAULT_ORDER),
        "extras",
    ]
    chosen = [key for key in layout.order if key in keys]
    return [*dict.fromkeys(chosen), *(key for key in keys if key not in chosen)]


def build_cv(
    profile: Profile,
    selected: list[int],
    draft: CvDraft | None,
    language: Language,
    search: str | None = None,
) -> CvContent:
    """CV ciblé : expériences retenues, dans l'ordre du profil, avec les missions reformulées."""
    identity = profile.identity
    chosen = chosen_search(profile, search)
    layout = chosen.cv_layout if chosen else CvLayout()
    rewritten = {item.index: item.groups for item in draft.experiences} if draft else {}
    experiences = [
        experience(source, language, rewritten.get(index) or None)
        for index, source in enumerate(profile.experiences)
        if index in selected
    ]
    words = WORDS[language]
    spoken = ", ".join(f"{item.name} – {item.level}" for item in profile.languages)
    lines = (
        ("languages", words["languages"], spoken),
        ("soft_skills", words["soft"], ", ".join(profile.soft_skills)),
        ("interests", words["interests"], ", ".join(profile.interests)),
    )
    extras = [LabeledLine(key=key, label=label, text=text) for key, label, text in lines if text]
    other_sections = sections(profile, language)
    titles = {
        key: label for key, names in layout.labels.items() if (label := (names or {}).get(language))
    }
    return CvContent(
        language=language,
        name=identity.full_name,
        headline=(draft.headline if draft else None) or identity.headline,
        show_photo=True,
        contact=contact(profile, language),
        details=[CONTRACTS.get(c, c) for c in contract_types(profile, search)[:2]],
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
        sections=other_sections,
        extras=extras,
        order=section_order(layout, other_sections),
        titles=titles,
        hidden=layout.hidden,
        font=layout.font,
        colors=layout.colors,
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
    profile: Profile,
    offer: Offer,
    draft: LetterDraft,
    language: Language,
    today: date,
    search: str | None = None,
) -> LetterContent:
    identity = profile.identity
    chosen = chosen_search(profile, search)
    layout = chosen.cv_layout if chosen else CvLayout()
    city = re.split(r"[/,]", identity.location)[0].strip() if identity.location else None
    sender = [identity.full_name]
    sender += [value for value in (identity.location, identity.phone, identity.email) if value]
    recipient = [value for value in (offer.company, offer.location) if value]
    return LetterContent(
        language=language,
        sender=sender,
        headline=identity.headline,
        contact=visible_contact(contact(profile, language), layout.hidden),
        font=layout.font,
        colors=layout.colors,
        recipient=recipient,
        place_date=place_date(city, language, today),
        subject=draft.subject,
        greeting=draft.greeting,
        paragraphs=draft.paragraphs,
        closing=draft.closing,
        signature=identity.full_name,
    )
