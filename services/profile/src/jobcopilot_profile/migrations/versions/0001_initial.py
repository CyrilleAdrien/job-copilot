"""Tables du profil : identité, expériences, critères de recherche.

Revision ID: 0001
Revises:
"""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import JSONB

revision = "0001"
down_revision = None
branch_labels = None
depends_on = None

SCHEMA = "profile"


def json_list(name: str, nullable: bool = False) -> sa.Column:
    return sa.Column(name, JSONB, nullable=nullable, server_default=sa.text("'[]'::jsonb"))


def upgrade() -> None:
    op.create_table(
        "profiles",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("full_name", sa.String(120), nullable=False),
        sa.Column("headline", sa.String(160), nullable=False),
        sa.Column("email", sa.String(254)),
        sa.Column("phone", sa.String(40)),
        sa.Column("location", sa.String(120)),
        sa.Column("availability", sa.String(120)),
        sa.Column("summary", sa.Text),
        json_list("links"),
        json_list("education"),
        json_list("skills"),
        json_list("languages"),
        json_list("soft_skills"),
        json_list("interests"),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()
        ),
        schema=SCHEMA,
    )
    op.create_table(
        "experiences",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column(
            "profile_id",
            sa.Integer,
            sa.ForeignKey(f"{SCHEMA}.profiles.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column("position", sa.Integer, nullable=False),
        sa.Column("title", sa.String(160), nullable=False),
        sa.Column("company", sa.String(160), nullable=False),
        sa.Column("location", sa.String(120)),
        sa.Column("contract", sa.String(60)),
        sa.Column("start", sa.String(7), nullable=False),
        sa.Column("end", sa.String(7)),
        sa.Column("context", sa.Text),
        json_list("groups"),
        json_list("technologies"),
        schema=SCHEMA,
    )
    op.create_table(
        "search_criteria",
        sa.Column(
            "profile_id",
            sa.Integer,
            sa.ForeignKey(f"{SCHEMA}.profiles.id", ondelete="CASCADE"),
            primary_key=True,
        ),
        json_list("roles"),
        json_list("technologies"),
        json_list("excluded_keywords"),
        sa.Column("seniority", sa.String(20), nullable=False),
        json_list("contract_types"),
        json_list("locations"),
        sa.Column("radius_km", sa.Integer, nullable=False),
        sa.Column("remote", sa.String(20), nullable=False),
        sa.Column("salary_min", sa.Integer),
        sa.Column("max_age_days", sa.Integer, nullable=False),
        schema=SCHEMA,
    )


def downgrade() -> None:
    op.drop_table("search_criteria", schema=SCHEMA)
    op.drop_table("experiences", schema=SCHEMA)
    op.drop_table("profiles", schema=SCHEMA)
