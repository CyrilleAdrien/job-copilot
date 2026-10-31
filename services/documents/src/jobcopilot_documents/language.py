"""Langue d'une offre, devinée à partir de mots outils très fréquents."""

import re

from jobcopilot_documents.schemas import Language

FRENCH = {
    "le",
    "la",
    "les",
    "des",
    "du",
    "et",
    "vous",
    "nous",
    "pour",
    "une",
    "dans",
    "sur",
    "avec",
}
ENGLISH = {"the", "and", "you", "we", "for", "with", "our", "your", "will", "are", "of", "to"}


def detect_language(text: str) -> Language:
    words = re.findall(r"[a-zà-ÿ]+", text.lower())
    french = sum(word in FRENCH for word in words)
    english = sum(word in ENGLISH for word in words)
    return "en" if english > french * 1.2 else "fr"
