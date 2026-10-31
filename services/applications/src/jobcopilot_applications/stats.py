"""Statistiques du tableau de bord, calculées à partir des candidatures et de leur historique.

- Réponse : passage à Entretien, Offre ou Refus après l'envoi (quelle que soit la source).
- Délai de réponse : de la date d'envoi à la première réponse.
- Relance à faire : candidature Envoyée ou Relancée sans changement depuis FOLLOW_UP_DAYS jours.
"""

import json
import logging
from collections import Counter
from datetime import UTC, datetime, timedelta

from redis.asyncio import Redis

from jobcopilot_applications.models import ApplicationRow
from jobcopilot_applications.schemas import STATUSES, FollowUp, Stats, WeekCount

RESPONSES = {"interview", "offer", "rejected"}
WAITING = {"sent", "followed_up"}
FOLLOW_UP_DAYS = 7
WEEKS = 12
CACHE_KEY = "applications:stats"
CACHE_TTL = 15 * 60

log = logging.getLogger(__name__)


def week_start(moment: datetime) -> datetime:
    day = moment.astimezone(UTC).replace(hour=0, minute=0, second=0, microsecond=0)
    return day - timedelta(days=day.weekday())


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
