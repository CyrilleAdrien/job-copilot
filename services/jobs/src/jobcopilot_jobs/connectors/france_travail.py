"""API Offres d'emploi v2 de France Travail (francetravail.io), authentification OAuth2."""

from datetime import datetime

import httpx
from redis.asyncio import Redis

from jobcopilot_jobs.connectors.base import SourceError, clean_text
from jobcopilot_jobs.places import parse_place
from jobcopilot_jobs.schemas import Query, RawOffer

TOKEN_URL = "https://entreprise.francetravail.fr/connexion/oauth2/access_token"
SEARCH_URL = "https://api.francetravail.io/partenaire/offresdemploi/v2/offres/search"
GEO_URL = "https://geo.api.gouv.fr/communes"
DETAIL_URL = "https://candidat.francetravail.fr/offres/recherche/detail/{id}"
SCOPE = "api_offresdemploiv2 o2dsoffre"

# L'API n'accepte que ces fenêtres de publication.
PUBLISHED_SINCE = {1: 1, 3: 3, 7: 7, 14: 14, 30: 31}
CONTRACTS = {"cdi": "CDI", "cdd": "CDD", "freelance": "LIB", "interim": "MIS"}
FROM_CONTRACT = {"CDI": "cdi", "CDD": "cdd", "LIB": "freelance", "MIS": "interim"}
# Villes à arrondissements : l'API attend le code d'un arrondissement, on cherche par département.
CITY_DEPARTMENTS = {"75056": "75", "69123": "69", "13055": "13"}
NO_LOCATION = {"france", "teletravail", "télétravail", "remote", "full remote"}


TOKEN_KEY = "jobs:france_travail:token"


class FranceTravail:
    name = "france_travail"
    label = "France Travail"

    def __init__(
        self, client: httpx.AsyncClient, cache: Redis, client_id: str | None, secret: str | None
    ):
        self.client = client
        self.cache = cache
        self.client_id = client_id
        self.secret = secret

    def configured(self) -> bool:
        return bool(self.client_id and self.secret)

    async def check(self) -> None:
        """Demande un nouveau jeton : l'ancien, en cache, ne prouverait rien."""
        await self.cache.delete(TOKEN_KEY)
        try:
            await self.token()
        except httpx.HTTPError as exc:
            raise SourceError("France Travail injoignable") from exc

    async def token(self) -> str:
        cached = await self.cache.get(TOKEN_KEY)
        if cached:
            return cached
        response = await self.client.post(
            TOKEN_URL,
            params={"realm": "/partenaire"},
            data={
                "grant_type": "client_credentials",
                "client_id": self.client_id,
                "client_secret": self.secret,
                "scope": SCOPE,
            },
        )
        if response.status_code != 200:
            raise SourceError("identifiants France Travail refusés")
        body = response.json()
        ttl = max(int(body.get("expires_in", 1500)) - 60, 60)
        await self.cache.set(TOKEN_KEY, body["access_token"], ex=ttl)
        return body["access_token"]

    async def place(self, location: str) -> dict[str, str] | None:
        """Traduit un lieu en codes INSEE : région, département ou commune (mise en cache 30 jours).

        None : un pays étranger, que France Travail ne couvre pas.
        """
        name = location.strip()
        place = parse_place(name)
        if place.kind == "country":
            return {} if place.country == "fr" else None
        if place.kind == "anywhere" or name.lower() in NO_LOCATION:
            return {}
        if place.kind == "region":
            return {"region": place.code or ""}
        if place.kind == "department":
            return {"departement": place.code or ""}
        key = f"jobs:geo:{name.lower()}"
        code = await self.cache.get(key)
        if code is None:
            response = await self.client.get(
                GEO_URL, params={"nom": name, "fields": "code", "boost": "population", "limit": 1}
            )
            communes = response.json() if response.status_code == 200 else []
            code = communes[0]["code"] if communes else ""
            await self.cache.set(key, code, ex=30 * 24 * 3600)
        if not code:
            return {}
        if code in CITY_DEPARTMENTS:
            return {"departement": CITY_DEPARTMENTS[code]}
        return {"commune": code}

    async def search(self, query: Query) -> list[RawOffer]:
        params: dict[str, str | int] = {
            "motsCles": query.keywords,
            "publieeDepuis": PUBLISHED_SINCE.get(query.max_age_days, 31),
            "sort": 1,
            "range": "0-149",
        }
        contracts = [CONTRACTS[c] for c in query.contract_types if c in CONTRACTS]
        if contracts and len(contracts) == len(query.contract_types):
            params["typeContrat"] = ",".join(contracts)
        if query.location:
            place = await self.place(query.location)
            if place is None:
                return []
            params.update(place)
            if "commune" in place:
                params["distance"] = query.radius_km

        token = await self.token()
        response = await self.client.get(
            SEARCH_URL, params=params, headers={"Authorization": f"Bearer {token}"}
        )
        if response.status_code == 204:
            return []
        if response.status_code not in (200, 206):
            raise SourceError(f"France Travail a répondu {response.status_code}")
        return [self.parse(item) for item in response.json().get("resultats", [])]

    def parse(self, item: dict) -> RawOffer:
        origin = (item.get("origineOffre") or {}).get("urlOrigine")
        return RawOffer(
            source=self.name,
            external_id=str(item["id"]),
            title=item.get("intitule", "").strip(),
            company=(item.get("entreprise") or {}).get("nom"),
            location=(item.get("lieuTravail") or {}).get("libelle"),
            contract=FROM_CONTRACT.get(item.get("typeContrat", "")),
            salary=(item.get("salaire") or {}).get("libelle"),
            description=clean_text(item.get("description")),
            url=origin or DETAIL_URL.format(id=item["id"]),
            published_at=datetime.fromisoformat(item["dateCreation"].replace("Z", "+00:00")),
        )
