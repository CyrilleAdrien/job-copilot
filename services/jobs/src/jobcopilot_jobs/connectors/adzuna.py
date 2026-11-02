"""API Adzuna (developer.adzuna.com), marché français."""

from datetime import datetime

import httpx

from jobcopilot_jobs.connectors.base import SourceError, clean_text
from jobcopilot_jobs.places import parse_place
from jobcopilot_jobs.schemas import Query, RawOffer

SEARCH_URL = "https://api.adzuna.com/v1/api/jobs/{country}/search/1"
FROM_CONTRACT = {"permanent": "cdi", "contract": "cdd"}


def salary_label(item: dict) -> str | None:
    if str(item.get("salary_is_predicted", "0")) == "1":
        return None
    low, high = item.get("salary_min"), item.get("salary_max")
    if not low and not high:
        return None
    amounts = [f"{round(value):,}".replace(",", " ") for value in (low, high) if value]
    return " – ".join(dict.fromkeys(amounts)) + " € par an"


class Adzuna:
    name = "adzuna"
    label = "Adzuna"

    def __init__(self, client: httpx.AsyncClient, app_id: str | None, app_key: str | None):
        self.client = client
        self.app_id = app_id
        self.app_key = app_key

    def configured(self) -> bool:
        return bool(self.app_id and self.app_key)

    async def check(self) -> None:
        params = {"app_id": self.app_id or "", "app_key": self.app_key or ""}
        try:
            response = await self.client.get(
                SEARCH_URL.format(country="fr"), params={**params, "results_per_page": 1}
            )
        except httpx.HTTPError as exc:
            raise SourceError("Adzuna injoignable") from exc
        if response.status_code in (401, 403):
            raise SourceError("identifiants Adzuna refusés")
        if response.status_code != 200:
            raise SourceError(f"Adzuna a répondu {response.status_code}")

    async def search(self, query: Query) -> list[RawOffer]:
        params: dict[str, str | int] = {
            "app_id": self.app_id or "",
            "app_key": self.app_key or "",
            "what": query.keywords,
            "max_days_old": query.max_age_days,
            "sort_by": "date",
            "results_per_page": 50,
        }
        place = parse_place(query.location)
        if place.kind in ("region", "department", "city"):
            # Adzuna lit les noms de lieux : « Hauts-de-Seine (92) » devient « Hauts-de-Seine ».
            params["where"] = place.name.split("(")[0].strip() or place.name
        if place.kind == "city":
            params["distance"] = query.radius_km
        response = await self.client.get(SEARCH_URL.format(country=place.country), params=params)
        if response.status_code in (401, 403):
            raise SourceError("identifiants Adzuna refusés")
        if response.status_code != 200:
            raise SourceError(f"Adzuna a répondu {response.status_code}")
        return [self.parse(item) for item in response.json().get("results", [])]

    def parse(self, item: dict) -> RawOffer:
        return RawOffer(
            source=self.name,
            external_id=str(item["id"]),
            title=clean_text(item.get("title")),
            company=(item.get("company") or {}).get("display_name"),
            location=(item.get("location") or {}).get("display_name"),
            contract=FROM_CONTRACT.get(item.get("contract_type", "")),
            salary=salary_label(item),
            description=clean_text(item.get("description")),
            url=item["redirect_url"],
            published_at=datetime.fromisoformat(item["created"].replace("Z", "+00:00")),
        )
