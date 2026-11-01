"""Dédoublonnage et score de pertinence d'une offre par rapport aux critères du profil.

Le score (0 à 100) est déterministe et explicable : intitulé, technologies,
séniorité, contrat et télétravail. Il ne fait pas appel au LLM.

En mode « skills », une offre n'est gardée que si elle cite assez de compétences
choisies par l'utilisateur (`min_skills`).
"""

import re
import unicodedata
from dataclasses import dataclass, field
from functools import lru_cache

from jobcopilot_jobs.schemas import Criteria

# Une offre est normalisée à chaque affichage de la liste : on garde le résultat en mémoire.
NORMALIZE_CACHE = 8192

STOP_WORDS = {"de", "des", "du", "la", "le", "les", "et", "en", "a", "h", "f", "hf", "fh"}
# Mots trop généraux pour distinguer deux métiers : « Data Engineer » et « Platform Engineer »
# ne se ressemblent que par eux. Ils ne comptent que si l'intitulé ne contient rien d'autre.
GENERIC_WORDS = {
    "ingenieur", "engineer", "developpeur", "developer", "consultant", "specialiste",
    "expert", "responsable", "chef", "charge", "technicien", "administrateur", "architecte",
}  # fmt: skip

SENIORITY_WORDS = {
    "graduate": ["junior", "debutant", "jeune diplome", "graduate", "premier emploi"],
    "mid": ["confirme", "experimente"],
    "senior": ["senior", "confirme", "experimente", "expert"],
    "lead": ["lead", "principal", "staff", "head of", "manager", "responsable"],
}
SENIOR_LEVELS = {"senior", "lead"}
LEVEL_RANK = {"graduate": 0, "mid": 1, "senior": 2, "lead": 3}
# « 5 ans d'expérience », « 3 à 5 ans minimum », « 7+ years of experience » (texte normalisé).
YEARS = re.compile(
    r"\b(\d{1,2})\s*(?:a\s*\d{1,2}\s*|\+\s*)?(?:ans|annees|years?)\s*"
    r"(?:minimum\s*|min\s*)?(?:d\s*|of\s*|de\s*)?(?:experience|exp)\b"
)

FULL_REMOTE = ["full remote", "100 teletravail", "teletravail complet", "100 remote"]
HYBRID = ["teletravail", "hybride", "remote"]


@lru_cache(maxsize=NORMALIZE_CACHE)
def normalize(text: str | None) -> str:
    """Minuscules, sans accents ni ponctuation : « C#/.NET » donne « c# net »."""
    if not text:
        return ""
    text = unicodedata.normalize("NFKD", text).encode("ascii", "ignore").decode()
    return " ".join(re.sub(r"[^a-z0-9+#]+", " ", text.lower()).split())


def contains(haystack: str, needle: str) -> bool:
    """Recherche par mots entiers dans des textes déjà normalisés."""
    return bool(needle) and f" {needle} " in f" {haystack} "


def dedup_key(title: str, company: str | None, location: str | None) -> str:
    """Même intitulé, même entreprise, même ville : la même offre vue par deux sources."""
    city = next((word for word in normalize(location).split() if not word.isdigit()), "")
    return f"{normalize(title)}|{normalize(company)}|{city}"[:400]


def remote_mode(text: str) -> str | None:
    if any(contains(text, phrase) for phrase in FULL_REMOTE):
        return "remote"
    if any(contains(text, phrase) for phrase in HYBRID):
        return "hybrid"
    return None


@dataclass
class Match:
    score: int
    matched: list[str] = field(default_factory=list)
    remote: str | None = None
    excluded: bool = False
    on_topic: bool = True
    enough_skills: bool = True
    too_senior: bool = False


def offer_level(title_n: str, text_n: str) -> int | None:
    """Niveau visé par l'offre : d'abord les mots de l'intitulé, sinon les années demandées."""
    ranks = [
        LEVEL_RANK[level]
        for level, words in SENIORITY_WORDS.items()
        if any(contains(title_n, normalize(word)) for word in words)
    ]
    if ranks:
        # « confirmé » sert à « mid » comme à « senior » : on garde le niveau le plus bas.
        return min(ranks)
    years = [int(found) for found in YEARS.findall(text_n) if 0 < int(found) < 30]
    if not years:
        return None
    least = min(years)
    return 2 if least >= 5 else 1 if least >= 3 else 0


def score_offer(criteria: Criteria, title: str, description: str, contract: str | None) -> Match:
    title_n = normalize(title)
    text_n = f"{title_n} {normalize(description)}"

    if any(contains(text_n, normalize(word)) for word in criteria.excluded_keywords):
        return Match(score=0, excluded=True)

    # Intitulé : part des mots du poste recherché présents dans le titre (40 points).
    role_score = 0.0
    for role in criteria.roles:
        words = [word for word in normalize(role).split() if word not in STOP_WORDS]
        words = [word for word in words if word not in GENERIC_WORDS] or words
        if not words:
            continue
        in_title = sum(contains(title_n, word) for word in words) / len(words)
        role_score = max(role_score, in_title * 40, 15 if contains(text_n, normalize(role)) else 0)

    # Compétences citées dans l'offre (35 points, plafonné à cinq compétences).
    skills = criteria.skills
    matched = [skill for skill in skills if contains(text_n, normalize(skill))]
    tech_score = 35 * min(1.0, len(matched) / min(len(skills), 5)) if skills else 17.5

    # Séniorité (10 points, pénalité si l'offre vise nettement plus haut).
    levels = [
        level
        for level, words in SENIORITY_WORDS.items()
        if any(contains(title_n, normalize(word)) for word in words)
    ]
    if not levels:
        seniority_score = 5
    elif criteria.seniority in levels:
        seniority_score = 10
    elif criteria.seniority in {"graduate", "mid"} and SENIOR_LEVELS & set(levels):
        seniority_score = -15
    else:
        seniority_score = 0

    # Contrat (10 points) et télétravail (5 points).
    contract_score = 5 if contract is None else 10 if contract in criteria.contract_types else 0

    remote = remote_mode(text_n)
    if criteria.remote == "remote":
        remote_score = 5 if remote == "remote" else 0
    elif criteria.remote == "hybrid":
        remote_score = 5 if remote else 2
    else:
        remote_score = 5

    total = role_score + tech_score + seniority_score + contract_score + remote_score
    return Match(
        score=max(0, min(100, round(total))),
        matched=matched,
        remote=remote,
        # Le métier se lit dans l'intitulé (ou l'offre le nomme) : des technologies communes
        # ne suffisent pas, sinon chaque profil de recherche verrait les offres des autres.
        on_topic=role_score > 0,
        # Une offre d'un niveau au-dessus de celui visé est écartée, pas seulement moins bien notée.
        too_senior=(level := offer_level(title_n, text_n)) is not None
        and level > LEVEL_RANK[criteria.seniority],
        enough_skills=criteria.match_mode == "domain"
        or len(matched) >= min(criteria.min_skills, len(skills)),
    )
