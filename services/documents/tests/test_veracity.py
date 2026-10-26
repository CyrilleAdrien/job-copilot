from jobcopilot_documents.compose import build_cv
from jobcopilot_documents.schemas import (
    CvDraft,
    DraftExperience,
    Group,
    LetterContent,
)
from jobcopilot_documents.veracity import check_cv, check_letter


def cv_with(profile, bullets: list[str], summary: str = "Ingénieur DevOps."):
    draft = CvDraft(
        headline="Ingénieur DevOps",
        summary=summary,
        experiences=[DraftExperience(index=0, groups=[Group(title=None, bullets=bullets)])],
    )
    return build_cv(profile, [0], draft, "fr")


def test_faithful_rewrite_passes(profile):
    cv = cv_with(profile, ["Temps de déploiement réduit de 45 à 10 minutes grâce à GitLab CI."])
    assert check_cv(profile, cv, same_language=True) == []


def test_invented_number_is_flagged(profile):
    [warning] = check_cv(profile, cv_with(profile, ["Migré 80 services vers Kubernetes."]), True)
    assert "80" in warning.reason


def test_invented_mission_is_flagged(profile):
    [warning] = check_cv(profile, cv_with(profile, ["Piloté une équipe de data scientists."]), True)
    assert warning.reason == "aucune mission proche dans le profil"


def test_translation_only_checks_numbers(profile):
    cv = cv_with(profile, ["Cut deployment time from 45 to 10 minutes with GitLab CI."])
    assert check_cv(profile, cv, same_language=False) == []


def test_letter_may_reuse_offer_numbers(profile, offer):
    letter = LetterContent(
        language="fr",
        sender=["Alex"],
        recipient=["Helio"],
        place_date="Lyon, le 26 octobre 2026",
        subject="Candidature",
        greeting="Madame, Monsieur,",
        paragraphs=["Rejoindre votre équipe de 12 personnes.", "J'ai migré 99 services."],
        closing="Cordialement,",
        signature="Alex",
    )
    [warning] = check_letter(profile, offer, letter)
    assert "99" in warning.reason
