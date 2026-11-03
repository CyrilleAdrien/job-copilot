"""Un CV complet par recherche.

Le titre, le résumé, les expériences et les sections du CV passent dans chaque recherche, avec
une copie par recherche. Le nom, le contact, la photo, les liens, le permis et les langues restent
communs. Au retour arrière, le CV de la première recherche redevient celui du profil.

Revision ID: 0005
Revises: 0004
"""

import json

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import JSONB

revision = "0005"
down_revision = "0004"
branch_labels = None
depends_on = None

SCHEMA = "profile"
SECTIONS = (
    "education",
    "skills",
    "certifications",
    "projects",
    "volunteering",
    "publications",
    "awards",
    "courses",
    "referees",
    "custom_sections",
    "soft_skills",
    "interests",
)
EXPERIENCE_FIELDS = (
    "title",
    "company",
    "location",
    "contract",
    "start",
    "end",
    "context",
    "groups",
    "technologies",
)


def upgrade() -> None:
    bind = op.get_bind()
    columns = ", ".join(("id", "headline", "summary", "searches", *SECTIONS))
    profiles = bind.execute(sa.text(f"SELECT {columns} FROM {SCHEMA}.profiles")).mappings().all()
    for row in profiles:
        fields = ", ".join(f'"{field}"' for field in EXPERIENCE_FIELDS)
        experiences = bind.execute(
            sa.text(
                f"SELECT {fields} FROM {SCHEMA}.experiences "
                "WHERE profile_id = :id ORDER BY position"
            ),
            {"id": row["id"]},
        ).mappings()
        cv = {
            "headline": row["headline"] or "",
            "summary": row["summary"],
            "experiences": [dict(item) for item in experiences],
            **{section: row[section] for section in SECTIONS},
        }
        searches = [{**search, "cv": cv} for search in row["searches"]]
        bind.execute(
            sa.text(
                f"UPDATE {SCHEMA}.profiles SET searches = CAST(:searches AS jsonb) WHERE id = :id"
            ),
            {"searches": json.dumps(searches), "id": row["id"]},
        )
    op.drop_table("experiences", schema=SCHEMA)
    for name in ("headline", "summary", *SECTIONS):
        op.drop_column("profiles", name, schema=SCHEMA)


def downgrade() -> None:
    op.add_column(
        "profiles",
        sa.Column("headline", sa.String(160), nullable=False, server_default=""),
        schema=SCHEMA,
    )
    op.add_column("profiles", sa.Column("summary", sa.Text), schema=SCHEMA)
    for name in SECTIONS:
        op.add_column(
            "profiles",
            sa.Column(name, JSONB, nullable=False, server_default=sa.text("'[]'::jsonb")),
            schema=SCHEMA,
        )
    op.create_table(
        "experiences",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column(
            "profile_id", sa.Integer, sa.ForeignKey(f"{SCHEMA}.profiles.id", ondelete="CASCADE")
        ),
        sa.Column("position", sa.Integer, nullable=False),
        sa.Column("title", sa.String(160), nullable=False),
        sa.Column("company", sa.String(160), nullable=False),
        sa.Column("location", sa.String(120)),
        sa.Column("contract", sa.String(60)),
        sa.Column("start", sa.String(7), nullable=False),
        sa.Column("end", sa.String(7)),
        sa.Column("context", sa.Text),
        sa.Column("groups", JSONB, nullable=False, server_default=sa.text("'[]'::jsonb")),
        sa.Column("technologies", JSONB, nullable=False, server_default=sa.text("'[]'::jsonb")),
        schema=SCHEMA,
    )

    bind = op.get_bind()
    rows = bind.execute(sa.text(f"SELECT id, searches FROM {SCHEMA}.profiles")).mappings().all()
    for row in rows:
        searches = [dict(search) for search in row["searches"]]
        cv = searches[0].get("cv", {}) if searches else {}
        for search in searches:
            search.pop("cv", None)
        assignments = ", ".join(f"{name} = CAST(:{name} AS jsonb)" for name in SECTIONS)
        bind.execute(
            sa.text(
                f"UPDATE {SCHEMA}.profiles SET headline = :headline, summary = :summary, "
                f"searches = CAST(:searches AS jsonb), {assignments} WHERE id = :id"
            ),
            {
                "id": row["id"],
                "headline": cv.get("headline", ""),
                "summary": cv.get("summary"),
                "searches": json.dumps(searches),
                **{name: json.dumps(cv.get(name, [])) for name in SECTIONS},
            },
        )
        for position, experience in enumerate(cv.get("experiences", [])):
            names = ", ".join(f'"{field}"' for field in EXPERIENCE_FIELDS)
            values = ", ".join(
                f"CAST(:{field} AS jsonb)" if field in ("groups", "technologies") else f":{field}"
                for field in EXPERIENCE_FIELDS
            )
            bind.execute(
                sa.text(
                    f"INSERT INTO {SCHEMA}.experiences (profile_id, position, {names}) "
                    f"VALUES (:profile_id, :position, {values})"
                ),
                {
                    "profile_id": row["id"],
                    "position": position,
                    **{field: experience.get(field) for field in EXPERIENCE_FIELDS},
                    "groups": json.dumps(experience.get("groups", [])),
                    "technologies": json.dumps(experience.get("technologies", [])),
                },
            )
