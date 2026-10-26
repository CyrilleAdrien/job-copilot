"""Contrôle de véracité : signale ce que le texte généré contient sans que le profil le dise."""

import re
import unicodedata

from jobcopilot_documents.schemas import CvContent, Kind, LetterContent, Offer, Profile, Warning

NUMBER = re.compile(r"\d+(?:[.,]\d+)?")
SIMILARITY_MIN = 0.3
STOP = {"de", "des", "du", "la", "le", "les", "et", "en", "a", "au", "aux", "un", "une", "the"}


def words(text: str) -> set[str]:
    text = unicodedata.normalize("NFKD", text).encode("ascii", "ignore").decode().lower()
    return {w for w in re.findall(r"[a-z0-9]+", text) if w not in STOP and len(w) > 1}


def numbers(text: str) -> set[str]:
    return {n.replace(",", ".") for n in NUMBER.findall(text.replace(" ", ""))}


def profile_text(profile: Profile) -> str:
    return profile.model_dump_json()


def unknown_numbers(text: str, source: set[str], kind: Kind) -> list[Warning]:
    return [
        Warning(kind=kind, text=text, reason=f"le chiffre {n} n'apparaît pas dans le profil")
        for n in sorted(numbers(text) - source)
    ]


def check_cv(profile: Profile, cv: CvContent, same_language: bool) -> list[Warning]:
    source_numbers = numbers(profile_text(profile))
    source_bullets = [
        words(bullet)
        for experience in profile.experiences
        for group in experience.groups
        for bullet in group.bullets
    ]
    warnings: list[Warning] = []
    for text in [cv.headline, cv.summary or ""]:
        warnings += unknown_numbers(text, source_numbers, "cv")
    for experience in cv.experiences:
        for group in experience.groups:
            for bullet in group.bullets:
                warnings += unknown_numbers(bullet, source_numbers, "cv")
                # Entre deux langues, les mots ne se comparent pas : seuls les chiffres comptent.
                if same_language and source_bullets:
                    tokens = words(bullet)
                    best = max(len(tokens & s) / max(len(tokens | s), 1) for s in source_bullets)
                    if best < SIMILARITY_MIN:
                        warnings.append(
                            Warning(
                                kind="cv",
                                text=bullet,
                                reason="aucune mission proche dans le profil",
                            )
                        )
    return warnings


def check_letter(profile: Profile, offer: Offer, letter: LetterContent) -> list[Warning]:
    # La lettre peut reprendre des chiffres de l'offre (effectifs, nombre d'utilisateurs).
    source = numbers(profile_text(profile)) | numbers(offer.description)
    return [w for p in letter.paragraphs for w in unknown_numbers(p, source, "letter")]
