from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class ApplicationsSettings(BaseSettings):
    """Services lus à la création d'une candidature : l'offre et ses documents."""

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    jobs_url: str = "http://jobs:8000"
    documents_url: str = "http://documents:8000"
    applications_http_timeout: float = 10.0
    # Lecture de l'événement document.generated ; désactivée dans les tests.
    applications_consume_events: bool = True


@lru_cache
def get_applications_settings() -> ApplicationsSettings:
    return ApplicationsSettings()
