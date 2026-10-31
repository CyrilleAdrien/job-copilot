from datetime import date

from jobcopilot_documents.compose import build_cv, build_letter, period, place_date
from jobcopilot_documents.language import detect_language
from jobcopilot_documents.render import render_sync
from jobcopilot_documents.schemas import CvDraft, DraftExperience, Group, LetterDraft


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
    assert cv.details == ["Lyon", "CDI"]
    assert cv.highlight == "Disponible immédiatement"
    assert cv.contact[-1].url == "https://github.com/alex"
    assert [line.label for line in cv.extras] == ["Savoir-être", "Langues et intérêts"]


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
    assert build_cv(profile, [0], None, "fr", "freelance").details == ["Lyon", "Freelance"]
    assert build_cv(profile, [0], None, "fr", "inconnue").details == ["Lyon", "CDI"]


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
