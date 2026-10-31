"""Statistiques du tableau de bord, calculées à partir des candidatures et de leur historique.

- Réponse : passage à Test technique, Entretien, Offre ou Refus après l'envoi (toute source).
- Délai de réponse : de la date d'envoi à la première réponse.
- Relance à faire : candidature Envoyée ou Relancée sans changement depuis FOLLOW_UP_DAYS jours.
- Par recherche : retours obtenus (test technique, entretien, offre, refus) d'après l'historique,
  pour voir quel profil visé fonctionne le mieux. Une recherche n'est classée qu'à partir de
  MIN_SAMPLE candidatures envoyées.
"""

import json
import logging
from collections import Counter
from datetime import UTC, datetime, timedelta

from redis.asyncio import Redis

from jobcopilot_applications.models import ApplicationRow
from jobcopilot_applications.schemas import (
    STATUSES,
    FollowUp,
    SearchOutcome,
    Stats,
    WeekCount,
)

RESPONSES = {"technical_test", "interview", "offer", "rejected"}
PROGRESS = {"technical_test", "interview", "offer"}
MIN_SAMPLE = 3
WAITING = {"sent", "followed_up"}
FOLLOW_UP_DAYS = 7
WEEKS = 12
CACHE_KEY = "applications:stats"
CACHE_TTL = 15 * 60

log = logging.getLogger(__name__)


def week_start(moment: datetime) -> datetime:
    day = moment.astimezone(UTC).replace(hour=0, minute=0, second=0, microsecond=0)
    return day - timedelta(days=day.weekday())


def rate(part: int, whole: int) -> float | None:
    return round(part / whole, 3) if whole else None


def outcomes(rows: list[ApplicationRow]) -> list[SearchOutcome]:
    groups: dict[str | None, list[ApplicationRow]] = {}
    for row in rows:
        if row.applied_at is not None:
            groups.setdefault(row.search_id, []).append(row)
    result = []
    for search_id, group in groups.items():
        reached = [{e.to_status for e in row.events} | {row.status} for row in group]
        responded = sum(bool(statuses & RESPONSES) for statuses in reached)
        progressed = sum(bool(statuses & PROGRESS) for statuses in reached)
        result.append(
            SearchOutcome(
                search_id=search_id,
                sent=len(group),
                responded=responded,
                technical_tests=sum("technical_test" in s for s in reached),
                interviews=sum("interview" in s for s in reached),
                offers=sum("offer" in s for s in reached),
                rejected=sum("rejected" in s for s in reached),
                response_rate=rate(responded, len(group)),
                progress_rate=rate(progressed, len(group)),
            )
        )
    result.sort(key=lambda o: (-(o.progress_rate or 0), -(o.response_rate or 0), -o.sent))
    return result


def best(by_search: list[SearchOutcome]) -> str | None:
    """La recherche (hors ajouts manuels) qui mène le plus souvent à un test ou un entretien."""
    ranked = [o for o in by_search if o.search_id is not None and o.sent >= MIN_SAMPLE]
    return ranked[0].search_id if ranked and ranked[0].progress_rate else None


def compute_stats(rows: list[ApplicationRow], now: datetime | None = None) -> Stats:
    now = now or datetime.now(UTC)
    by_status = Counter(row.status for row in rows)
    sent = [row for row in rows if row.applied_at is not None]

    delays: list[float] = []
    responded = 0
    for row in sent:
        first = min(
            (e.created_at for e in row.events if e.to_status in RESPONSES),
            default=None,
        )
        if first is None:
            continue
        responded += 1
        delays.append(max((first - row.applied_at).total_seconds(), 0) / 86400)

    current = week_start(now)
    starts = [current - timedelta(weeks=WEEKS - 1 - index) for index in range(WEEKS)]
    per_week = Counter(week_start(row.applied_at) for row in sent)
    weekly = [WeekCount(week=start.date(), sent=per_week.get(start, 0)) for start in starts]

    follow_ups = []
    for row in rows:
        if row.status not in WAITING:
            continue
        last = max((e.created_at for e in row.events), default=row.applied_at or row.created_at)
        waiting = (now - last).days
        if waiting >= FOLLOW_UP_DAYS:
            follow_ups.append(
                FollowUp(
                    id=row.id,
                    title=row.title,
                    company=row.company,
                    status=row.status,
                    contact_email=row.contact_email,
                    since=last,
                    days=waiting,
                )
            )
    follow_ups.sort(key=lambda item: item.since)

    by_search = outcomes(rows)
    return Stats(
        total=len(rows),
        sent=len(sent),
        by_status={status: by_status.get(status, 0) for status in STATUSES},
        responded=responded,
        response_rate=round(responded / len(sent), 3) if sent else None,
        average_response_days=round(sum(delays) / len(delays), 1) if delays else None,
        weekly=weekly,
        follow_ups=follow_ups,
        follow_up_days=FOLLOW_UP_DAYS,
        by_search=by_search,
        best_search=best(by_search),
        min_sample=MIN_SAMPLE,
        computed_at=now,
    )


async def cached(cache: Redis) -> Stats | None:
    try:
        raw = await cache.get(CACHE_KEY)
    except Exception:  # noqa: BLE001
        return None
    return Stats.model_validate(json.loads(raw)) if raw else None


async def store(cache: Redis, stats: Stats) -> None:
    try:
        await cache.set(CACHE_KEY, stats.model_dump_json(), ex=CACHE_TTL)
    except Exception:  # noqa: BLE001
        log.warning("statistiques non mises en cache", exc_info=True)


async def invalidate(cache: Redis) -> None:
    """À chaque création, modification ou suppression : le tableau de bord se recalcule."""
    try:
        await cache.delete(CACHE_KEY)
    except Exception:  # noqa: BLE001
        log.warning("cache des statistiques non vidé", exc_info=True)
