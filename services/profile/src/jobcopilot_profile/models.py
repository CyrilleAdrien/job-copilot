from datetime import datetime

from sqlalchemy import JSON, DateTime, Integer, LargeBinary, String, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column

SCHEMA = "profile"
Json = JSON().with_variant(JSONB(), "postgresql")


class Base(DeclarativeBase):
    pass


class ProfileRow(Base):
    """Un seul profil par installation : l'outil tourne en local pour une personne."""

    __tablename__ = "profiles"
    __table_args__ = {"schema": SCHEMA}

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    full_name: Mapped[str] = mapped_column(String(120))
    email: Mapped[str | None] = mapped_column(String(254))
    phone: Mapped[str | None] = mapped_column(String(40))
    location: Mapped[str | None] = mapped_column(String(120))
    address: Mapped[str | None] = mapped_column(String(200))
    birth_date: Mapped[str | None] = mapped_column(String(10))
    nationality: Mapped[str | None] = mapped_column(String(60))
    driving_licence: Mapped[str | None] = mapped_column(String(40))
    availability: Mapped[str | None] = mapped_column(String(120))
    links: Mapped[list] = mapped_column(Json, default=list)
    languages: Mapped[list] = mapped_column(Json, default=list)
    # Recherches et leur CV, dans l'ordre choisi : lus et écrits toujours ensemble.
    searches: Mapped[list] = mapped_column(Json, default=list)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )


class PhotoRow(Base):
    """La photo de profil. À part du profil : les autres services et le YAML n'en ont pas besoin."""

    __tablename__ = "photos"
    __table_args__ = {"schema": SCHEMA}

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    data: Mapped[bytes] = mapped_column(LargeBinary)
    content_type: Mapped[str] = mapped_column(String(20))
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
