from datetime import datetime

from sqlalchemy import JSON, DateTime, ForeignKey, Integer, String, Text, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship

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
    headline: Mapped[str] = mapped_column(String(160))
    email: Mapped[str | None] = mapped_column(String(254))
    phone: Mapped[str | None] = mapped_column(String(40))
    location: Mapped[str | None] = mapped_column(String(120))
    availability: Mapped[str | None] = mapped_column(String(120))
    summary: Mapped[str | None] = mapped_column(Text)
    links: Mapped[list] = mapped_column(Json, default=list)
    education: Mapped[list] = mapped_column(Json, default=list)
    skills: Mapped[list] = mapped_column(Json, default=list)
    languages: Mapped[list] = mapped_column(Json, default=list)
    soft_skills: Mapped[list] = mapped_column(Json, default=list)
    interests: Mapped[list] = mapped_column(Json, default=list)
    certifications: Mapped[list] = mapped_column(Json, default=list)
    projects: Mapped[list] = mapped_column(Json, default=list)
    volunteering: Mapped[list] = mapped_column(Json, default=list)
    publications: Mapped[list] = mapped_column(Json, default=list)
    # Profils de recherche, dans l'ordre choisi : lus et écrits toujours ensemble.
    searches: Mapped[list] = mapped_column(Json, default=list)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    experiences: Mapped[list["ExperienceRow"]] = relationship(
        order_by="ExperienceRow.position", cascade="all, delete-orphan", lazy="selectin"
    )


class ExperienceRow(Base):
    __tablename__ = "experiences"
    __table_args__ = {"schema": SCHEMA}

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    profile_id: Mapped[int] = mapped_column(ForeignKey(f"{SCHEMA}.profiles.id", ondelete="CASCADE"))
    position: Mapped[int] = mapped_column(Integer)
    title: Mapped[str] = mapped_column(String(160))
    company: Mapped[str] = mapped_column(String(160))
    location: Mapped[str | None] = mapped_column(String(120))
    contract: Mapped[str | None] = mapped_column(String(60))
    start: Mapped[str] = mapped_column(String(7))
    end: Mapped[str | None] = mapped_column(String(7))
    context: Mapped[str | None] = mapped_column(Text)
    groups: Mapped[list] = mapped_column(Json, default=list)
    technologies: Mapped[list] = mapped_column(Json, default=list)
