from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class CalendarSettings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    applications_url: str = "http://applications:8000"
    # Clé maître du chiffrement des mots de passe CalDAV (make secret l'ajoute à .env).
    # Calendrier de démonstration : un serveur CalDAV fictif, en mémoire.
    calendar_demo: bool = False
    calendar_http_timeout: float = 10.0
    caldav_timeout: int = 30
    # Rappel avant chaque événement, dans le flux .ics et sur le calendrier distant.
    reminder_minutes: int = 60
    # Fenêtre du flux .ics : les événements passés depuis N jours, et tous ceux à venir.
    feed_past_days: int = 90


@lru_cache
def get_calendar_settings() -> CalendarSettings:
    return CalendarSettings()
