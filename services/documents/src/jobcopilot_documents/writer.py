"""Rédaction : le LLM choisit et reformule, sans jamais rien ajouter au profil.

Trois appels courts plutôt qu'un long, plus fiables avec un modèle 7B :
sélection des expériences, réécriture du CV, lettre.
"""

import json
from typing import Protocol

from jobcopilot_common.llm import LLM
from jobcopilot_documents.schemas import (
    CvDraft,
    DraftExperience,
    Language,
    LetterDraft,
    Offer,
    Profile,
    Selection,
)

LANGUAGE_NAMES = {"fr": "français", "en": "anglais"}
OFFER_LIMIT = 3000

SYSTEM = (
    "Tu aides un candidat à adapter son CV et sa lettre à une offre d'emploi. "
    "Règle absolue : tu n'inventes rien. Tu peux seulement choisir, réordonner, raccourcir "
    "et reformuler ce qui figure dans le profil. Tu gardes chaque chiffre tel quel, tu "
    "n'ajoutes ni technologie, ni entreprise, ni diplôme, ni résultat. Pas d'émoji, pas de "
    "superlatifs creux. Tu réponds uniquement en JSON, au format demandé."
)


class Writer(Protocol):
    async def select(self, profile: Profile, offer: Offer) -> Selection: ...

    async def write_cv(
        self, profile: Profile, offer: Offer, selection: Selection, language: Language
    ) -> CvDraft: ...

    async def write_letter(
        self, profile: Profile, offer: Offer, selection: Selection, language: Language
    ) -> LetterDraft: ...


def offer_text(offer: Offer) -> str:
    return (
        f"Poste : {offer.title}\nEntreprise : {offer.company or 'non précisée'}\n"
        f"Lieu : {offer.location or 'non précisé'}\n\n{offer.description[:OFFER_LIMIT]}"
    )


def experiences_json(profile: Profile, indexes: list[int] | None = None, full: bool = True) -> str:
    items = []
    for index, item in enumerate(profile.experiences):
        if indexes is not None and index not in indexes:
            continue
        entry: dict = {"index": index, "poste": item.title, "entreprise": item.company}
        entry["technologies"] = item.technologies
        if full:
            entry["contexte"] = item.context
            entry["groupes"] = [group.model_dump() for group in item.groups]
        else:
            entry["themes"] = [group.title for group in item.groups if group.title]
        items.append(entry)
    return json.dumps(items, ensure_ascii=False)


def skills_text(profile: Profile) -> str:
    return "; ".join(f"{c.name} : {', '.join(c.items)}" for c in profile.skills)


def clamp_selection(profile: Profile, selection: Selection) -> Selection:
    """Garde des index valides ; si le modèle n'en retient aucun, toutes les expériences restent."""
    valid = sorted({i for i in selection.experience_indexes if 0 <= i < len(profile.experiences)})
    return Selection(
        requirements=selection.requirements[:8],
        experience_indexes=valid or list(range(len(profile.experiences))),
    )


class LLMWriter:
    def __init__(self, llm: LLM):
        self.llm = llm

    async def select(self, profile: Profile, offer: Offer) -> Selection:
        prompt = (
            f"Offre :\n{offer_text(offer)}\n\n"
            f"Expériences du candidat :\n{experiences_json(profile, full=False)}\n\n"
            f"Compétences : {skills_text(profile)}\n\n"
            "1. Liste au plus 8 exigences clés de l'offre (technologies, missions, savoir-faire), "
            "en quelques mots chacune.\n"
            "2. Donne les index des expériences utiles pour cette offre. Garde-les toutes si le "
            "candidat en a trois ou moins."
        )
        return clamp_selection(profile, await self.llm.complete(SYSTEM, prompt, Selection))

    async def write_cv(
        self, profile: Profile, offer: Offer, selection: Selection, language: Language
    ) -> CvDraft:
        identity = profile.identity
        prompt = (
            f"Offre :\n{offer_text(offer)}\n\n"
            f"Exigences clés : {', '.join(selection.requirements)}\n\n"
            f"Titre actuel : {identity.headline}\nRésumé actuel : {identity.summary or ''}\n\n"
            f"Expériences retenues :\n{experiences_json(profile, selection.experience_indexes)}\n\n"
            f"Écris en {LANGUAGE_NAMES[language]} :\n"
            "- headline : le titre du CV, proche de l'intitulé de l'offre s'il correspond au "
            "profil, 8 mots au plus ;\n"
            "- summary : le résumé du profil réécrit pour l'offre, 4 phrases au plus, à partir du "
            "résumé actuel et des expériences uniquement ;\n"
            "- experiences : pour chaque expérience retenue (même index), ses groupes de missions "
            "avec les puces les plus utiles pour l'offre en premier, 3 groupes et 4 puces par "
            "groupe au plus. Chaque puce reformule une puce existante et garde ses chiffres."
        )
        return await self.llm.complete(SYSTEM, prompt, CvDraft)

    async def write_letter(
        self, profile: Profile, offer: Offer, selection: Selection, language: Language
    ) -> LetterDraft:
        identity = profile.identity
        prompt = (
            f"Offre :\n{offer_text(offer)}\n\n"
            f"Exigences clés : {', '.join(selection.requirements)}\n\n"
            f"Candidat : {identity.full_name}, {identity.headline}. {identity.summary or ''}\n"
            f"Disponibilité : {identity.availability or 'non précisée'}\n"
            f"Expériences :\n{experiences_json(profile, selection.experience_indexes)}\n\n"
            f"Écris une lettre de motivation en {LANGUAGE_NAMES[language]}, sobre et précise :\n"
            "- subject : l'objet, avec l'intitulé du poste ;\n"
            "- greeting : la formule d'appel ;\n"
            "- paragraphs : 3 ou 4 paragraphes (pourquoi cette entreprise et ce poste, ce que le "
            "candidat apporte avec deux ou trois réalisations chiffrées tirées des expériences, "
            "disponibilité et proposition d'échange) ;\n"
            "- closing : la formule de politesse, sans la signature."
        )
        return await self.llm.complete(SYSTEM, prompt, LetterDraft)


class DemoWriter:
    """Sans LLM (LLM_PROVIDER=demo) : garde le profil tel quel, lettre à partir d'un modèle."""

    async def select(self, profile: Profile, offer: Offer) -> Selection:
        return Selection(
            requirements=offer.matched or [offer.title],
            experience_indexes=list(range(len(profile.experiences))),
        )

    async def write_cv(
        self, profile: Profile, offer: Offer, selection: Selection, language: Language
    ) -> CvDraft:
        return CvDraft(
            headline=profile.identity.headline,
            summary=profile.identity.summary or "",
            experiences=[
                DraftExperience(index=index, groups=profile.experiences[index].groups)
                for index in selection.experience_indexes
            ],
        )

    async def write_letter(
        self, profile: Profile, offer: Offer, selection: Selection, language: Language
    ) -> LetterDraft:
        identity = profile.identity
        company = offer.company or ("votre entreprise" if language == "fr" else "your company")
        skills = ", ".join(selection.requirements[:4])
        if language == "en":
            return LetterDraft(
                subject=f"Application for the {offer.title} position",
                greeting="Dear Hiring Manager,",
                paragraphs=[
                    f"I am applying for the {offer.title} position at {company}.",
                    f"As a {identity.headline}, I work daily with {skills}.",
                    "I would be glad to discuss how I can contribute to your team.",
                ],
                closing="Kind regards,",
            )
        return LetterDraft(
            subject=f"Candidature au poste de {offer.title}",
            greeting="Madame, Monsieur,",
            paragraphs=[
                f"Je vous propose ma candidature au poste de {offer.title} chez {company}.",
                f"{identity.headline}, je travaille au quotidien avec {skills}.",
                "Je serais heureux d'échanger avec vous sur ce poste et sur ce que je peux "
                "apporter à votre équipe.",
            ],
            closing="Je vous prie d'agréer, Madame, Monsieur, mes salutations distinguées.",
        )
