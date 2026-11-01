"""Classement d'une réponse : refus, test technique, entretien, offre, demande d'infos...

Avec Ollama, le LLM lit l'objet et le texte ; en mode démo, ou si le LLM échoue, des règles
sur les tournures habituelles (français et anglais) prennent le relais.
"""

import re
from typing import Literal, Protocol

from pydantic import BaseModel, Field

from jobcopilot_common.llm import LLM, LLMError
from jobcopilot_mail.matching import fold

Category = Literal[
    "rejection", "technical_test", "interview", "offer", "info_request", "acknowledgment", "other"
]  # fmt: skip
STATUS_FOR: dict[str, str] = {
    "rejection": "rejected",
    "technical_test": "technical_test",
    "interview": "interview",
    "offer": "offer",
}


class Classification(BaseModel):
    category: Category
    confidence: float = Field(ge=0, le=1)
    reason: str = Field(max_length=300, description="Phrase courte qui justifie le choix")


class Classifier(Protocol):
    async def classify(
        self, subject: str, sender: str, text: str, about: str
    ) -> Classification: ...


# Ordre de priorité : un refus cite souvent l'entretien, une offre cite souvent la candidature.
RULES: list[tuple[str, re.Pattern[str]]] = [
    ("offer", re.compile(
        r"promesse d.embauche|proposition d.embauche|heureux de vous (proposer|confirmer)|"
        r"pleased to offer|job offer|offer letter|contrat de travail ci-joint")),
    ("rejection", re.compile(
        r"ne pas donner suite|pas (pu )?(etre )?retenu|n.avons pas retenu|pas en mesure de|"
        r"regret|malheureusement|ne correspond pas|autres? candidat|unfortunately|"
        r"not (to )?(move|moving) forward|decided to pursue other|will not be progressing")),
    ("technical_test", re.compile(
        r"test technique|exercice technique|cas pratique|coding (challenge|test|game)|"
        r"take.home|hackerrank|codingame|codility|technical (test|assessment|exercise)")),
    ("interview", re.compile(
        r"entretien|vous rencontrer|echange telephonique|vos disponibilites|creneau|"
        r"interview|schedule a (call|meeting)|meet you|calendly")),
    ("info_request", re.compile(
        r"pourriez.vous (nous )?(transmettre|envoyer|preciser)|merci de nous (transmettre|envoyer)|"
        r"pieces? manquantes?|pretentions salariales|could you (send|provide|share)")),
    ("acknowledgment", re.compile(
        r"bien recu|accuse de reception|nous avons (bien )?recu|reviendrons vers vous|"
        r"thank you for (applying|your application)|received your application")),
]  # fmt: skip


class RuleClassifier:
    async def classify(self, subject: str, sender: str, text: str, about: str) -> Classification:
        content = fold(f"{subject}\n{text}")
        found = [(name, pattern.search(content)) for name, pattern in RULES]
        hits = [(name, m) for name, m in found if m]
        if not hits:
            return Classification(
                category="other", confidence=0.5, reason="Aucune tournure connue."
            )
        name, first = hits[0]
        # Plusieurs catégories reconnues : la première l'emporte, mais avec moins d'assurance.
        confidence = 0.85 if len(hits) == 1 or name in {"offer", "rejection"} else 0.7
        return Classification(
            category=name,  # type: ignore[arg-type]
            confidence=confidence,
            reason=f"Tournure reconnue : « {first.group(0)} ».",
        )


SYSTEM = """Tu classes la réponse d'un recruteur à une candidature. Catégories :
- rejection : la candidature est refusée ou ne sera pas poursuivie ;
- technical_test : on propose un test technique, un exercice ou un cas pratique ;
- interview : on propose un entretien, un appel ou demande des disponibilités ;
- offer : on propose une embauche (promesse, offre, contrat) ;
- info_request : on demande un document ou une information (CV, prétentions, date de début) ;
- acknowledgment : simple accusé de réception, sans décision ;
- other : autre chose.
Donne une confiance entre 0 et 1, plus basse si le mail est ambigu, et une phrase courte en français
qui justifie le choix. Réponds uniquement en JSON."""


class LLMClassifier:
    def __init__(self, llm: LLM, fallback: Classifier | None = None):
        self.llm = llm
        self.fallback = fallback or RuleClassifier()

    async def classify(self, subject: str, sender: str, text: str, about: str) -> Classification:
        prompt = f"Candidature : {about}\nExpéditeur : {sender}\nObjet : {subject}\n\n{text[:3000]}"
        try:
            return await self.llm.complete(SYSTEM, prompt, Classification)
        except LLMError:
            result = await self.fallback.classify(subject, sender, text, about)
            result.reason = f"{result.reason} (LLM indisponible, règles utilisées)"
            return result
