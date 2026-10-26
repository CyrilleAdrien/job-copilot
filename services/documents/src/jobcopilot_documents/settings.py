from functools import lru_cache
from typing import Literal

from pydantic_settings import BaseSettings, SettingsConfigDict


class DocumentsSettings(BaseSettings):
    """Réglages de la génération : services amont, LLM et stockage S3 (voir .env.example)."""

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    profile_url: str = "http://profile:8000"
    jobs_url: str = "http://jobs:8000"
    llm_provider: Literal["ollama", "demo"] = "ollama"
    s3_bucket: str = "documents"
    s3_access_key: str = "jobcopilot"
    s3_secret_key: str = "jobcopilot"
    s3_region: str = "us-east-1"


@lru_cache
def get_documents_settings() -> DocumentsSettings:
    return DocumentsSettings()
