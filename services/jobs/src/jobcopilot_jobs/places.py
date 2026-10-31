"""Lecture d'un lieu saisi au profil : pays, région, département ou ville.

Les sources ne comprennent pas les mêmes choses : France Travail attend des codes INSEE
(région, département, commune), Adzuna un pays dans l'URL et un nom de lieu libre.
"""

import re
from dataclasses import dataclass
from typing import Literal

from jobcopilot_jobs.matching import normalize

# Pays couverts par Adzuna, avec leur code dans l'URL de l'API.
COUNTRIES = {
    "france": "fr", "belgique": "be", "suisse": "ch", "allemagne": "de", "espagne": "es",
    "italie": "it", "pays bas": "nl", "royaume uni": "gb", "autriche": "at", "pologne": "pl",
    "canada": "ca", "etats unis": "us", "australie": "au", "nouvelle zelande": "nz",
    "singapour": "sg", "inde": "in", "bresil": "br", "mexique": "mx", "afrique du sud": "za",
}  # fmt: skip

# Régions françaises et leur code INSEE.
REGIONS = {
    "ile de france": "11", "centre val de loire": "24", "bourgogne franche comte": "27",
    "normandie": "28", "hauts de france": "32", "grand est": "44", "pays de la loire": "52",
    "bretagne": "53", "nouvelle aquitaine": "75", "occitanie": "76",
    "auvergne rhone alpes": "84", "provence alpes cote d azur": "93", "paca": "93", "corse": "94",
}  # fmt: skip

ANYWHERE = {"", "partout", "teletravail", "remote", "full remote"}
# « Hauts-de-Seine (92) », « Corse-du-Sud (2A) » ou le numéro seul.
DEPARTMENT = re.compile(r"^(?:.*\()?\s*(\d{2,3}|2[ab])\s*\)?$", re.IGNORECASE)


@dataclass(frozen=True)
class Place:
    kind: Literal["anywhere", "country", "region", "department", "city"]
    name: str
    country: str = "fr"
    code: str | None = None


def parse_place(text: str | None) -> Place:
    raw = (text or "").strip()
    key = normalize(raw)
    if key in ANYWHERE:
        return Place("anywhere", raw)
    if key in COUNTRIES:
        return Place("country", raw, country=COUNTRIES[key])
    if key in REGIONS:
        return Place("region", raw, code=REGIONS[key])
    if match := DEPARTMENT.match(raw):
        return Place("department", raw, code=match.group(1).upper())
    return Place("city", raw)
