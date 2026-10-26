import uuid
from datetime import datetime

from sqlalchemy import JSON, Boolean, DateTime, ForeignKey, Integer, String, Text, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship

SCHEMA = "documents"
Json = JSON().with_variant(JSONB(), "postgresql")


class Base(DeclarativeBase):
    pass


class GenerationRow(Base):
    """Une demande de génération pour une offre et son avancement, étape par étape."""

    __tablename__ = "generations"
    __table_args__ = {"schema": SCHEMA}

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    offer_id: Mapped[int] = mapped_column(Integer, index=True)
    offer_title: Mapped[str | None] = mapped_column(String(300))
    company: Mapped[str | None] = mapped_column(String(200))
    language: Mapped[str | None] = mapped_column(String(2))
    with_letter: Mapped[bool] = mapped_column(Boolean)
    status: Mapped[str] = mapped_column(String(10), default="running")
    step: Mapped[int] = mapped_column(Integer, default=0)
    error: Mapped[str | None] = mapped_column(Text)
    warnings: Mapped[list] = mapped_column(Json, default=list)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    documents: Mapped[list["DocumentRow"]] = relationship(
        order_by="DocumentRow.kind", lazy="selectin", cascade="all, delete-orphan"
    )


class DocumentRow(Base):
    """CV ou lettre : le contenu structuré en base, le PDF dans le bucket S3."""

    __tablename__ = "documents"
    __table_args__ = {"schema": SCHEMA}

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    generation_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey(f"{SCHEMA}.generations.id", ondelete="CASCADE")
    )
    offer_id: Mapped[int] = mapped_column(Integer)
    kind: Mapped[str] = mapped_column(String(10))
    language: Mapped[str] = mapped_column(String(2))
    template: Mapped[str] = mapped_column(String(40), default="classic")
    version: Mapped[int] = mapped_column(Integer, default=1)
    pages: Mapped[int] = mapped_column(Integer, default=1)
    s3_key: Mapped[str] = mapped_column(String(300))
    content: Mapped[dict] = mapped_column(Json)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
