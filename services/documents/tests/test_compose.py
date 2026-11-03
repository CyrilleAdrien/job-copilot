from datetime import date

import httpx

from jobcopilot_documents.compose import build_cv, build_letter, period, place_date
from jobcopilot_documents.language import detect_language
from jobcopilot_documents.render import render_sync
from jobcopilot_documents.schemas import (
    Award,
    Course,
    CustomSection,
    CvDraft,
    DraftExperience,
    Education,
    Group,
    LetterDraft,
    Link,
    Profile,
)
from jobcopilot_documents.upstream import fetch_photo


def test_period():
    assert period("2024-09", None, "fr") == "09/2024 – aujourd'hui"
    assert period("2022-01", "2023-06", "en") == "01/2022 – 06/2023"


def test_place_date():
    assert place_date("Lyon", "fr", date(2026, 11, 1)) == "Lyon, le 1er novembre 2026"
    assert place_date("Lyon", "en", date(2026, 11, 3)) == "Lyon, November 3, 2026"


def test_detect_language():
    assert detect_language("Vous rejoindrez une équipe pour opérer nos clusters") == "fr"
    assert detect_language("You will join our team and run the platform with us") == "en"


def test_cv_keeps_selected_experiences_and_rewritten_groups(profile):
    draft = CvDraft(
        headline="Ingénieur DevOps Kubernetes",
        summary="Résumé ciblé.",
        experiences=[
            DraftExperience(index=0, groups=[Group(title="Cloud", bullets=["Migré 30 services."])])
        ],
    )
    cv = build_cv(profile, [0], draft, "fr")
    assert cv.headline == "Ingénieur DevOps Kubernetes"
    assert [e.company for e in cv.experiences] == ["Nimbus"]
    assert cv.experiences[0].title == "Ingénieur DevOps (Alternance)"
    assert cv.experiences[0].groups[0].bullets == ["Migré 30 services."]
    assert cv.details == ["CDI"]
    assert cv.highlight == "Disponible immédiatement"
    assert cv.contact[-1].url == "https://github.com/alex"
    assert [line.label for line in cv.extras] == ["Langues", "Qualités", "Centres d'intérêt"]


def test_cv_without_draft_keeps_profile_content(profile):
    cv = build_cv(profile, [0, 1], None, "fr")
    assert cv.summary == profile.identity.summary
    assert len(cv.experiences) == 2


def test_cv_lists_secondary_sections_in_order(profile):
    cv = build_cv(profile, [0], None, "en")
    assert [section.title for section in cv.sections] == [
        "Projects",
        "Certifications",
        "Volunteering",
    ]
    project, certification, volunteering = (section.entries[0] for section in cv.sections)
    assert project.meta == ["FastAPI, Next.js"]
    assert project.url == "https://github.com/alex/job-copilot"
    assert certification.meta == ["CNCF", "2025"]
    assert volunteering.meta == ["Asso", "01/2023 – present"]


def test_cv_contract_follows_the_chosen_search(profile):
    assert build_cv(profile, [0], None, "fr", "freelance").details == ["Freelance"]
    assert build_cv(profile, [0], None, "fr", "inconnue").details == ["CDI"]


def test_rendered_documents_are_pdf(profile, offer):
    cv = build_cv(profile, [0, 1], None, "fr")
    draft = LetterDraft(
        subject="Candidature",
        greeting="Madame, Monsieur,",
        paragraphs=["Un."],
        closing="Cordialement,",
    )
    letter = build_letter(profile, offer, draft, "fr", date(2026, 10, 26))
    assert letter.recipient == ["Helio", "Paris"]
    assert render_sync("cv", cv).startswith(b"%PDF")
    assert render_sync("letter", letter).startswith(b"%PDF")


def test_contact_lists_coordinates_with_their_icon(profile):
    profile.identity.driving_licence = "B"
    profile.identity.links = [
        Link(label="GitHub", url="https://github.com/alex"),
        Link(label="LinkedIn", url="https://www.linkedin.com/in/alex"),
        Link(label="Faux", url="https://github.com.evil.io/x"),
        Link(label="Piège", url="javascript:alert(1)"),
    ]
    items = build_cv(profile, [0], None, "fr").contact
    assert [item.kind for item in items] == [
        "location", "email", "phone", "github", "linkedin", "link", "link", "licence",
    ]  # fmt: skip
    assert items[1].url == "mailto:alex@example.org"
    assert items[2].url == "tel:0600000000"
    assert items[6].url is None
    assert items[7].text == "Permis B"


def test_cv_leaves_out_private_details_by_default(profile):
    data = profile.model_dump()
    data["identity"] |= {
        "address": "1 rue de la Paix",
        "birth_date": "1998-03-14",
        "nationality": "Française",
    }
    data["referees"] = [{"name": "Sam Durand"}]
    text = build_cv(Profile.model_validate(data), [0], None, "fr").model_dump_json()
    for private in ("rue de la Paix", "1998", "Française", "Sam Durand"):
        assert private not in text


def test_cv_includes_education_details_and_new_sections(profile):
    profile.education = [
        Education(
            degree="Master", school="ESEO", location="Paris", start="2024-09", end="2026-08",
            details="Mention bien",
        )
    ]  # fmt: skip
    profile.courses = [Course(name="Kubernetes", institution="CNCF", year=2025)]
    profile.awards = [Award(title="Prix", issuer="BPCE", year=2025, description="Pour X")]
    profile.custom_sections = [CustomSection(title="Conférences", items=["DevOps Days"])]
    cv = build_cv(profile, [0], None, "fr")
    assert cv.education[0].period == "09/2024 – 08/2026"
    assert cv.education[0].location == "Paris"
    assert cv.education[0].details == "Mention bien"
    titles = [section.title for section in cv.sections]
    assert titles[-3:] == ["Formations suivies", "Récompenses", "Conférences"]
    assert cv.sections[-1].bullets == ["DevOps Days"]


def test_letter_shares_the_cv_header_and_keeps_only_the_city(profile, offer):
    profile.identity.location = "Clamart, France"
    draft = LetterDraft(subject="S", greeting="G", paragraphs=["P"], closing="C")
    letter = build_letter(profile, offer, draft, "fr", date(2026, 11, 3))
    assert letter.place_date == "Clamart, le 3 novembre 2026"
    assert letter.headline == profile.identity.headline
    assert letter.contact[0].kind == "location"


def test_photo_appears_in_the_rendered_cv(profile):
    cv = build_cv(profile, [0], None, "fr")
    png = (
        b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x06\x00\x00\x00"
        b"\x1f\x15\xc4\x89\x00\x00\x00\rIDATx\x9cc\xf8\xcf\xc0\xf0\x1f\x00\x05\x00\x01\xff"
        b"\x89\x99=\x1d\x00\x00\x00\x00IEND\xaeB`\x82"
    )
    with_photo = render_sync("cv", cv, png)
    assert with_photo.startswith(b"%PDF")
    assert len(with_photo) > len(render_sync("cv", cv))
    # Un ancien document, enregistré sans photo, reste sans photo.
    old = cv.model_copy(update={"show_photo": False})
    assert len(render_sync("cv", old, png)) < len(with_photo)


async def test_unreadable_photo_is_ignored():
    async def answer(content: bytes, status: int = 200):
        transport = httpx.MockTransport(lambda _: httpx.Response(status, content=content))
        async with httpx.AsyncClient(transport=transport) as client:
            return await fetch_photo(client)

    assert await answer(b"\x89PNG\r\n\x1a\nrest") == b"\x89PNG\r\n\x1a\nrest"
    assert await answer(b"not an image") is None
    assert await answer(b"\x89PNG\r\n\x1a\n", 404) is None
