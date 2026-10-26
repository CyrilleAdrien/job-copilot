import html
import re
from typing import Protocol

from jobcopilot_jobs.schemas import Query, RawOffer


class SourceError(Exception):
    """Une source a répondu en erreur : la recherche continue avec les autres."""


class Connector(Protocol):
    name: str
    label: str

    def configured(self) -> bool: ...

    async def search(self, query: Query) -> list[RawOffer]: ...


def clean_text(text: str | None) -> str:
    """Retire le HTML éventuel et les espaces superflus d'une description."""
    if not text:
        return ""
    text = re.sub(r"<br\s*/?>|</p>|</li>", "\n", text, flags=re.IGNORECASE)
    text = html.unescape(re.sub(r"<[^>]+>", "", text))
    lines = (" ".join(line.split()) for line in text.splitlines())
    return "\n".join(line for line in lines if line)
