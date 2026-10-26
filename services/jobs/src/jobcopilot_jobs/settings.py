from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class JobsSettings(BaseSettings):
    """Clés des sources d'offres et réglages de collecte (voir .env.example)."""

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    profile_url: str = "http://profile:8000"
    france_travail_client_id: str | None = None
    france_travail_client_secret: str | None = None
    adzuna_app_id: str | None = None
    adzuna_app_key: str | None = None
    jobs_demo: bool = False
    jobs_refresh_ttl: int = 900
    jobs_http_timeout: float = 15.0
    jobs_retention_days: int = 60


@lru_cache
def get_jobs_settings() -> JobsSettings:
    return JobsSettings()
