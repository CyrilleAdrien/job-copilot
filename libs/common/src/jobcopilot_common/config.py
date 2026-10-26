from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Configuration lue dans les variables d'environnement (voir .env.example)."""

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str = "postgresql://jobcopilot:jobcopilot@postgres:5432/jobcopilot"
    redis_url: str = "redis://redis:6379/0"
    s3_endpoint: str = "http://s3:8333"
    ollama_url: str = "http://ollama:11434"
    ollama_model: str = "qwen2.5:7b"
    llm_timeout: float = 600.0
    llm_context: int = 8192
    check_timeout: float = 2.0


@lru_cache
def get_settings() -> Settings:
    return Settings()
