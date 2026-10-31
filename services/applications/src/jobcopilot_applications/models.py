import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship

SCHEMA = "applications"


class Base(DeclarativeBase):
    pass


class ApplicationRow(Base):
    """Une candidature. L'offre est recopiée : elle reste lisible après la purge des offres."""

    __tablename__ = "applications"
    __table_args__ = {"schema": SCHEMA}

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    offer_id: Mapped[int | None] = mapped_column(Integer, unique=True)
    search_id: Mapped[str | None] = mapped_column(String(40))
    title: Mapped[str] = mapped_column(String(300))
    company: Mapped[str | None] = mapped_column(String(200))
    location: Mapped[str | None] = mapped_column(String(200))
    url: Mapped[str | None] = mapped_column(String(1000))
    source: Mapped[str | None] = mapped_column(String(30))
    description: Mapped[str | None] = mapped_column(Text)
    contact_email: Mapped[str | None] = mapped_column(String(320))
    status: Mapped[str] = mapped_column(String(20), default="draft", index=True)
    applied_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    cv_document_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True))
    letter_document_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True))
    notes: Mapped[str] = mapped_column(Text, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    events: Mapped[list["StatusEventRow"]] = relationship(
        back_populates="application",
        order_by="StatusEventRow.created_at",
        cascade="all, delete-orphan",
        lazy="selectin",
    )


class StatusEventRow(Base):
    """Historique des statuts : d'où vient chaque changement (manuel, mail, système)."""

    __tablename__ = "status_events"
    __table_args__ = {"schema": SCHEMA}

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    application_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey(f"{SCHEMA}.applications.id", ondelete="CASCADE"), index=True
    )
    from_status: Mapped[str | None] = mapped_column(String(20))
    to_status: Mapped[str] = mapped_column(String(20))
    source: Mapped[str] = mapped_column(String(20), default="manual")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    application: Mapped[ApplicationRow] = relationship(back_populates="events")
