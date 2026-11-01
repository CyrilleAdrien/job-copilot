from datetime import UTC, datetime
from email.message import EmailMessage
from types import SimpleNamespace

import pytest

from jobcopilot_common.llm import LLMError
from jobcopilot_mail import crypto
from jobcopilot_mail.classify import LLMClassifier, RuleClassifier
from jobcopilot_mail.mailbox import Header, ImapMailbox, text_of
from jobcopilot_mail.matching import Candidate, match
from jobcopilot_mail.settings import get_mail_settings
from jobcopilot_mail.sync import should_apply

NOW = datetime(2026, 10, 30, tzinfo=UTC)
APPS = [
    Candidate("a1", "Ingénieur DevOps", "Nimbus Data", "jobs@nimbus.example", "sent"),
    Candidate("a2", "SRE", "Atelier Numérique", None, "sent"),
    Candidate("a3", "Data Engineer", "Quartz", None, "draft"),
]


def header(sender: str, subject: str, name: str | None = None) -> Header:
    return Header(1, "<m@x>", sender, name, subject, NOW)


@pytest.mark.parametrize(
    ("sender", "subject", "name", "expected", "reason"),
    [
        ("jobs@nimbus.example", "Re: candidature", None, "a1", "adresse de contact"),
        ("rh@ateliernumerique.fr", "Votre candidature", None, "a2", "domaine"),
        ("rh@atelier-numerique.fr", "Suite", None, "a2", "domaine"),
        ("noreply@greenhouse.io", "Atelier Numérique : votre candidature", None, "a2", "citée"),
        ("someone@gmail.com", "Bonjour", "Atelier Numérique RH", "a2", "citée"),
    ],
)
def test_match_links_the_reply_to_its_application(sender, subject, name, expected, reason):
    found = match(header(sender, subject, name), APPS)
    assert found is not None and found.application is not None
    assert found.application.id == expected
    assert reason in found.reason


def test_unrelated_mail_is_ignored_and_recruiting_mail_is_kept_unlinked():
    assert match(header("news@lettre.example", "Les outils de la semaine"), APPS) is None
    # Un domaine grand public ne suffit pas à rattacher.
    assert match(header("ami@gmail.com", "Salut"), APPS) is None
    unlinked = match(header("talents@talents.example", "Votre candidature a bien été reçue"), APPS)
    assert unlinked is not None and unlinked.application is None
    # Une candidature « À envoyer » n'attend pas de réponse.
    assert match(header("rh@quartz.example", "Bonjour"), APPS) is None


def test_company_named_in_the_body_links_after_download():
    mail = header("talents@talents.example", "Votre candidature")
    assert match(mail, APPS).application is None
    assert match(mail, APPS, "Merci pour votre intérêt pour Nimbus Data.").application.id == "a1"


def test_several_applications_at_the_same_company():
    apps = [
        Candidate("c1", "Ingénieur Cloud", "Nimbus Data", None, "sent", "2026-10-01"),
        Candidate("c2", "Data Engineer", "Nimbus Data", None, "followed_up", "2026-09-01"),
        Candidate("c3", "SRE", "Nimbus Data", None, "rejected", "2026-10-20"),
    ]
    mail = header("rh@nimbusdata.example", "Votre candidature")
    # Le titre du poste dans le texte départage les candidatures.
    found = match(mail, apps, "Votre candidature au poste de Data Engineer")
    assert found.application.id == "c2" and not found.ambiguous
    # Sans le titre : la candidature en cours la plus récente, mais à confirmer.
    found = match(mail, apps, "Merci pour votre candidature.")
    assert found.application.id == "c1" and found.ambiguous
    # Une seule candidature en cours : pas d'ambiguïté avec une candidature close.
    found = match(mail, [apps[0], apps[2]], "Merci.")
    assert found.application.id == "c1" and not found.ambiguous


@pytest.mark.parametrize(
    ("subject", "body", "category"),
    [
        (
            "Votre candidature",
            "Nous avons le regret de ne pas donner suite après l'entretien.",
            "rejection",
        ),
        ("Application update", "Unfortunately we decided not to move forward.", "rejection"),
        ("Suite", "Nous vous proposons un test technique sur CodinGame.", "technical_test"),
        (
            "Entretien",
            "Pourriez-vous nous indiquer vos disponibilités pour un entretien ?",
            "interview",
        ),
        (
            "Bonne nouvelle",
            "Nous sommes heureux de vous proposer le poste, promesse d'embauche jointe.",
            "offer",
        ),
        ("Accusé de réception", "Nous avons bien reçu votre candidature.", "acknowledgment"),
        ("Documents", "Merci de nous transmettre vos prétentions salariales.", "info_request"),
        ("Hello", "Quelques nouvelles de notre équipe.", "other"),
    ],
)
async def test_rules_recognise_usual_wording(subject, body, category):
    result = await RuleClassifier().classify(subject, "rh@x.fr", body, "poste")
    assert result.category == category
    assert 0 <= result.confidence <= 1


async def test_llm_failure_falls_back_to_rules():
    class Broken:
        model = "x"

        async def complete(self, *args):
            raise LLMError("down")

    result = await LLMClassifier(Broken()).classify(
        "Suite", "rh@x.fr", "Pas retenu, malheureusement.", ""
    )
    assert result.category == "rejection"
    assert "LLM indisponible" in result.reason


@pytest.mark.parametrize(
    ("current", "target", "expected"),
    [
        ("sent", "interview", True),
        ("followed_up", "technical_test", True),
        ("technical_test", "interview", True),
        ("interview", "technical_test", False),  # un mail ne fait jamais reculer
        ("interview", "rejected", True),
        ("sent", "offer", True),
        ("draft", "interview", False),  # pas encore envoyée
        ("rejected", "interview", False),  # issue déjà connue
        ("withdrawn", "rejected", False),
        ("interview", "interview", False),
    ],
)
def test_should_apply_only_moves_forward(current, target, expected):
    assert should_apply(current, target) is expected


def test_password_is_encrypted_and_needs_the_secret_key(monkeypatch):
    token = crypto.encrypt("abcd efgh ijkl mnop")
    assert "abcd" not in token
    assert crypto.decrypt(token) == "abcd efgh ijkl mnop"
    monkeypatch.setattr(get_mail_settings(), "secret_key", "")
    with pytest.raises(crypto.SecretKeyMissing):
        crypto.encrypt("x")


def test_imap_header_and_text_are_decoded():
    envelope = SimpleNamespace(
        from_=[
            SimpleNamespace(
                name=b"=?utf-8?q?Atelier_Num=C3=A9rique?=", mailbox=b"RH", host=b"Atelier.fr"
            )
        ],
        subject=b"=?utf-8?q?Votre_candidature_=C3=A0_l=27atelier?=",
        message_id=b"<abc@atelier.fr>",
        date=None,
    )
    parsed = ImapMailbox.header(7, {b"ENVELOPE": envelope, b"INTERNALDATE": datetime(2026, 10, 1)})
    assert parsed.from_address == "rh@atelier.fr"
    assert parsed.from_name == "Atelier Numérique"
    assert parsed.subject == "Votre candidature à l'atelier"
    assert parsed.received_at.tzinfo is not None

    message = EmailMessage()
    message.set_content("Bonjour,\n\nversion texte")
    message.add_alternative("<p>Bonjour, <b>version HTML</b></p>", subtype="html")
    assert text_of(message) == "Bonjour, version texte"
    html_only = EmailMessage()
    html_only.set_content(
        "<p>Nous avons &eacute;tudi&eacute; <b>votre</b> profil</p>", subtype="html"
    )
    assert text_of(html_only) == "Nous avons étudié votre profil"
