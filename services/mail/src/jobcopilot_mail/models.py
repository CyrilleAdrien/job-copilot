import uuid
from datetime import datetime

from sqlalchemy import (
    Boolean,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column

SCHEMA = "mail"


class Base(DeclarativeBase):
    pass


class AccountRow(Base):
    """Une boîte mail lue en IMAP. Le mot de passe d'application est chiffré (Fernet)."""

    __tablename__ = "accounts"
    __table_args__ = {"schema": SCHEMA}

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email: Mapped[str] = mapped_column(String(320))
    host: Mapped[str] = mapped_column(String(200))
    port: Mapped[int] = mapped_column(Integer, default=993)
    username: Mapped[str] = mapped_column(String(320))
    password_encrypted: Mapped[str] = mapped_column(Text)
    folder: Mapped[str] = mapped_column(String(200), default="INBOX")
    last_uid: Mapped[int] = mapped_column(Integer, default=0)
    uid_validity: Mapped[int | None] = mapped_column(Integer)
    last_sync_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    last_error: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class MessageRow(Base):
    """Un mail lié aux candidatures. Les autres mails ne sont ni stockés ni envoyés au LLM."""

    __tablename__ = "messages"
    __table_args__ = (UniqueConstraint("account_id", "message_id"), {"schema": SCHEMA})

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    account_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey(f"{SCHEMA}.accounts.id", ondelete="CASCADE"), index=True
    )
    message_id: Mapped[str] = mapped_column(String(500))
    uid: Mapped[int] = mapped_column(Integer)
    from_address: Mapped[str] = mapped_column(String(320))
    from_name: Mapped[str | None] = mapped_column(String(300))
    subject: Mapped[str] = mapped_column(String(500), default="")
    received_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)
    snippet: Mapped[str] = mapped_column(Text, default="")
    category: Mapped[str] = mapped_column(String(30), default="other")
    confidence: Mapped[float] = mapped_column(Float, default=0.0)
    reason: Mapped[str] = mapped_column(Text, default="")
    application_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), index=True)
    match_reason: Mapped[str | None] = mapped_column(String(200))
    suggested_status: Mapped[str | None] = mapped_column(String(20))
    status_applied: Mapped[bool] = mapped_column(Boolean, default=False)
    reviewed: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
