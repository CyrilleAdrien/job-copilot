"""Rattachement d'un mail à une candidature, d'après l'expéditeur, l'objet puis le texte.

Seuls les mails rattachés ou qui parlent manifestement de recrutement sont gardés.
"""

import re
import unicodedata
from dataclasses import dataclass

from jobcopilot_mail.mailbox import Header

# Fournisseurs grand public : leur domaine ne dit rien de l'entreprise.
PUBLIC_DOMAINS = {
    "gmail.com", "googlemail.com", "outlook.com", "hotmail.com", "hotmail.fr", "live.com",
    "live.fr", "yahoo.com", "yahoo.fr", "icloud.com", "me.com", "orange.fr", "free.fr",
    "laposte.net", "proton.me", "protonmail.com", "gmx.fr", "sfr.fr", "wanadoo.fr",
}  # fmt: skip
# Plateformes de recrutement : le domaine ne désigne pas l'entreprise, mais le mail en parle.
ATS_DOMAINS = (
    "greenhouse.io", "lever.co", "workday", "smartrecruiters", "teamtailor", "welcomekit",
    "welcometothejungle", "recruitee", "jobvite", "taleo", "successfactors", "flatchr",
)  # fmt: skip
GENERIC = {"sas", "sarl", "group", "groupe", "france", "the", "and", "les", "des", "inc", "ltd"}
JOB_WORDS = re.compile(
    r"candidature|postul|entretien|recrut|offre d.emploi|votre profil|test technique|"
    r"application|interview|hiring|recruit|assessment|coding (challenge|test)|position|job offer",
)
LINK_THRESHOLD = 0.7
# Candidatures en attente d'une réponse : préférées quand deux candidatures se valent.
OPEN = {"sent", "followed_up", "technical_test", "interview"}


@dataclass
class Candidate:
    """Ce que le service mail sait d'une candidature (lu auprès du service applications)."""

    id: str
    title: str
    company: str | None
    contact_email: str | None
    status: str
    applied_at: str | None = None


@dataclass
class Match:
    application: Candidate | None
    score: float
    reason: str
    # Une autre candidature en cours obtient le même score : rattachement à vérifier.
    ambiguous: bool = False


def fold(text: str | None) -> str:
    normalized = unicodedata.normalize("NFD", text or "")
    return "".join(c for c in normalized if not unicodedata.combining(c)).lower()


def company_tokens(company: str | None) -> list[str]:
    words = re.findall(r"[a-z0-9]+", fold(company))
    return [w for w in words if len(w) >= 3 and w not in GENERIC]


def score(header: Header, text: str, candidate: Candidate) -> tuple[float, str]:
    sender = header.from_address.lower()
    domain = sender.rsplit("@", 1)[-1]
    tokens = company_tokens(candidate.company)
    slug = "".join(tokens)
    headline = fold(f"{header.from_name or ''} {header.subject}")
    best, reason = 0.0, ""
    if candidate.contact_email and sender == candidate.contact_email.lower():
        best, reason = 1.0, "adresse de contact de l'offre"
    elif (
        slug
        and domain not in PUBLIC_DOMAINS
        and (slug in domain.replace("-", "") or any(t in domain.split(".") for t in tokens))
    ):
        best, reason = 0.85, "domaine de l'entreprise"
    elif tokens and all(t in headline for t in tokens):
        best, reason = 0.75, "entreprise citée dans l'expéditeur ou l'objet"
    elif tokens and text and all(t in fold(text) for t in tokens):
        best, reason = 0.7, "entreprise citée dans le mail"
    title = fold(candidate.title)
    if best and title and title in headline:
        best = min(1.0, best + 0.1)
    elif best and title and text and title in fold(text):
        best = min(1.0, best + 0.05)
    return best, reason


def match(header: Header, candidates: list[Candidate], text: str = "") -> Match | None:
    """La candidature la plus probable, ou un mail de recrutement à rattacher, ou None (ignoré)."""
    ranked = sorted(
        ((*score(header, text, c), c) for c in candidates if c.status != "draft"),
        key=lambda item: (item[0], item[2].status in OPEN, item[2].applied_at or ""),
        reverse=True,
    )
    if ranked and ranked[0][0] >= LINK_THRESHOLD:
        value, reason, candidate = ranked[0]
        ambiguous = candidate.status in OPEN and any(
            other_value == value and other.status in OPEN for other_value, _, other in ranked[1:]
        )
        return Match(candidate, value, reason, ambiguous)
    domain = header.from_address.rsplit("@", 1)[-1]
    if JOB_WORDS.search(fold(f"{header.from_name or ''} {header.subject}")) or any(
        ats in domain for ats in ATS_DOMAINS
    ):
        return Match(None, 0.0, "mail de recrutement sans candidature correspondante")
    return None
