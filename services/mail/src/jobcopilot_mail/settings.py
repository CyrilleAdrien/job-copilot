from functools import lru_cache
from typing import Literal

from pydantic_settings import BaseSettings, SettingsConfigDict


class MailSettings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    applications_url: str = "http://applications:8000"
    # Clé maître du chiffrement des mots de passe IMAP (make secret l'ajoute à .env).
    llm_provider: Literal["ollama", "demo"] = "ollama"
    # Boîte de démonstration : des réponses fictives aux candidatures, sans compte IMAP.
    mail_demo: bool = False
    # Lecture périodique de toutes les boîtes ; désactivée dans les tests.
    mail_sync_enabled: bool = True
    mail_sync_minutes: int = 15
    # Première lecture d'une boîte : les mails des N derniers jours.
    mail_lookback_days: int = 30
    # En dessous de ce score, le statut n'est pas changé : le mail est « à vérifier ».
    mail_auto_apply_confidence: float = 0.75
    mail_http_timeout: float = 10.0
    imap_timeout: float = 30.0
    smtp_timeout: float = 30.0


@lru_cache
def get_mail_settings() -> MailSettings:
    return MailSettings()
