from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text, UniqueConstraint, func
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column

SCHEMA = "jobs"


class Base(DeclarativeBase):
    pass


class OfferRow(Base):
    """Offre brute : le score dépend du profil courant, il est calculé à la lecture."""

    __tablename__ = "offers"
    __table_args__ = (
        UniqueConstraint("source", "external_id", name="offers_source_external_id_key"),
        {"schema": SCHEMA},
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    source: Mapped[str] = mapped_column(String(30))
    external_id: Mapped[str] = mapped_column(String(120))
    dedup_key: Mapped[str] = mapped_column(String(400), index=True)
    title: Mapped[str] = mapped_column(String(300))
    company: Mapped[str | None] = mapped_column(String(200))
    location: Mapped[str | None] = mapped_column(String(200))
    contract: Mapped[str | None] = mapped_column(String(20))
    salary: Mapped[str | None] = mapped_column(String(120))
    description: Mapped[str] = mapped_column(Text)
    url: Mapped[str] = mapped_column(String(1000))
    published_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)
    fetched_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )


class FavoriteRow(Base):
    """Offre mise de côté pour un profil de recherche : elle échappe à la purge."""

    __tablename__ = "favorites"
    __table_args__ = {"schema": SCHEMA}

    search_id: Mapped[str] = mapped_column(String(40), primary_key=True)
    offer_id: Mapped[int] = mapped_column(
        ForeignKey(f"{SCHEMA}.offers.id", ondelete="CASCADE"), primary_key=True
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
