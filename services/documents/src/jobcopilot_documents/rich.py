"""Le texte enrichi des CV : **gras**, *italique*, __souligné__, listes en « - » et « 1. ».

Le template cv.typ et web/src/lib/rich-text.ts appliquent exactement les mêmes règles. Un texte sans
ces marques reste tel quel, et une marque isolée (5 * 3, un ** seul) reste du texte.
"""

import re
from dataclasses import dataclass

ESCAPABLE = set("*_\\-.0123456789")
NUMBERED = re.compile(r"^\d+\. ")


@dataclass(frozen=True)
class Run:
    text: str
    bold: bool = False
    italic: bool = False
    underline: bool = False


def tokens(value: str) -> list[tuple[str, str]]:
    """Découpe en (nature, texte). La nature est `text`, `bold`, `italic` ou `underline`."""
    result: list[tuple[str, str]] = []
    opened = {"italic": False, "underline": False}
    index = 0

    def is_mark(kind: str, size: int) -> bool:
        # Fermer demande un caractère juste avant, ouvrir un caractère juste après.
        if opened[kind]:
            return index > 0 and not value[index - 1].isspace()
        return index + size < len(value) and not value[index + size].isspace()

    while index < len(value):
        char, pair = value[index], value[index : index + 2]
        if char == "\\" and index + 1 < len(value) and value[index + 1] in ESCAPABLE:
            result.append(("text", value[index + 1]))
            index += 2
        elif pair == "**":
            result.append(("bold", pair))
            index += 2
        elif pair == "__" and is_mark("underline", 2):
            opened["underline"] = not opened["underline"]
            result.append(("underline", pair))
            index += 2
        elif char == "*" and is_mark("italic", 1):
            opened["italic"] = not opened["italic"]
            result.append(("italic", char))
            index += 1
        else:
            result.append(("text", char))
            index += 1
    return result


def parse_inline(value: str) -> list[Run]:
    """Les passages d'une ligne avec leur style. Une marque sans sa paire redevient du texte."""
    parsed = tokens(value)
    counts = {kind: sum(1 for item, _ in parsed if item == kind) for kind in _STYLES}
    state = dict.fromkeys(_STYLES, False)
    runs: list[Run] = []
    buffer = ""

    def flush() -> None:
        nonlocal buffer
        if buffer:
            runs.append(Run(buffer, **state))
            buffer = ""

    for kind, text in parsed:
        if kind in state and counts[kind] % 2 == 0:
            flush()
            state[kind] = not state[kind]
        else:
            buffer += text
    flush()
    return runs


_STYLES = ("bold", "italic", "underline")


def parse_blocks(value: str) -> list[tuple[str, str]]:
    """Les lignes d'un texte : (`text`, `bullet` ou `number`, ligne sans sa marque de liste)."""
    blocks: list[tuple[str, str]] = []
    for line in value.split("\n"):
        stripped = line.strip()
        if not stripped:
            continue
        if stripped.startswith("- "):
            blocks.append(("bullet", stripped[2:]))
        elif NUMBERED.match(stripped):
            blocks.append(("number", NUMBERED.sub("", stripped)))
        else:
            blocks.append(("text", stripped))
    return blocks
