from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

from jobcopilot_mail.classify import Category


class Provider(BaseModel):
    id: str
    label: str
    host: str
    port: int = 993
    help: str


class AccountCreate(BaseModel):
    email: str = Field(min_length=3, max_length=320)
    host: str = Field(min_length=1, max_length=200)
    port: int = Field(993, ge=1, le=65535)
    username: str | None = Field(None, max_length=320, description="L'adresse par défaut")
    password: str = Field("", max_length=500, description="Mot de passe d'application")
    folder: str = Field("INBOX", max_length=200)


class Account(BaseModel):
    """Jamais de mot de passe dans une réponse."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    email: str
    host: str
    port: int
    username: str
    folder: str
    last_sync_at: datetime | None
    last_error: str | None
    created_at: datetime
    messages: int = 0


class Message(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    account_id: UUID
    from_address: str
    from_name: str | None
    subject: str
    received_at: datetime
    snippet: str
    category: Category
    confidence: float
    reason: str
    application_id: UUID | None
    match_reason: str | None
    suggested_status: str | None
    status_applied: bool
    reviewed: bool


class MessageUpdate(BaseModel):
    category: Category | None = None
    application_id: UUID | None = None
    reviewed: bool | None = None
    # Pour détacher un mail : {"application_id": null} explicite.


class SyncReport(BaseModel):
    accounts: int
    new: int
    linked: int
    applied: int
    errors: list[str]


Review = Literal["all", "pending"]
