"""Export iCalendar (RFC 5545) : un fichier par événement, et le flux auquel on s'abonne."""

from datetime import UTC, datetime, timedelta

from icalendar import Alarm, Calendar, Event

from jobcopilot_calendar.models import EventRow

PRODID = "-//job-copilot//calendar//FR"
KINDS = {
    "interview": "Entretien",
    "technical_test": "Test technique",
    "follow_up": "Relance",
    "other": "Rendez-vous",
}


def uid(row: EventRow) -> str:
    """Identifiant stable : le même événement se met à jour au lieu d'être dupliqué."""
    return f"{row.id}@job-copilot"


def description(row: EventRow) -> str:
    parts = [row.notes.strip()] if row.notes.strip() else []
    if row.video_url:
        parts.append(f"Visio : {row.video_url}")
    return "\n\n".join(parts)


def vevent(row: EventRow, reminder_minutes: int, now: datetime | None = None) -> Event:
    event = Event()
    event.add("uid", uid(row))
    event.add("dtstamp", now or datetime.now(UTC))
    event.add("dtstart", row.starts_at.astimezone(UTC))
    event.add("dtend", row.ends_at.astimezone(UTC))
    event.add("summary", row.title)
    event.add("sequence", row.sequence)
    event.add("categories", [KINDS.get(row.kind, "Rendez-vous")])
    if row.location:
        event.add("location", row.location)
    if row.video_url:
        event.add("url", row.video_url)
    if text := description(row):
        event.add("description", text)
    if reminder_minutes > 0:
        alarm = Alarm()
        alarm.add("action", "DISPLAY")
        alarm.add("description", row.title)
        alarm.add("trigger", timedelta(minutes=-reminder_minutes))
        event.add_component(alarm)
    return event


def calendar(rows: list[EventRow], reminder_minutes: int, name: str = "Job Copilot") -> bytes:
    cal = Calendar()
    cal.add("prodid", PRODID)
    cal.add("version", "2.0")
    cal.add("calscale", "GREGORIAN")
    cal.add("x-wr-calname", name)
    # Les applications de calendrier relisent le flux toutes les heures au plus.
    cal.add("refresh-interval", timedelta(hours=1), parameters={"VALUE": "DURATION"})
    cal.add("x-published-ttl", "PT1H")
    for row in rows:
        cal.add_component(vevent(row, reminder_minutes))
    return cal.to_ical()
