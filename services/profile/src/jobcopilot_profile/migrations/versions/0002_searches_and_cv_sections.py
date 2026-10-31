"""Profils de recherche multiples et sections de CV supplémentaires.

Les critères de l'ancienne table `search_criteria` deviennent le premier profil de
recherche, nommé « Principal ».

Revision ID: 0002
Revises: 0001
"""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import JSONB

revision = "0002"
down_revision = "0001"
branch_labels = None
depends_on = None

SCHEMA = "profile"
NEW_LISTS = ("certifications", "projects", "volunteering", "publications", "searches")


def upgrade() -> None:
    for name in NEW_LISTS:
        op.add_column(
            "profiles",
            sa.Column(name, JSONB, nullable=False, server_default=sa.text("'[]'::jsonb")),
            schema=SCHEMA,
        )
    op.execute(
        f"""
        UPDATE {SCHEMA}.profiles AS p
        SET searches = jsonb_build_array(
            jsonb_build_object(
                'id', 'principal',
                'name', 'Principal',
                'roles', s.roles,
                'technologies', s.technologies,
                'excluded_keywords', s.excluded_keywords,
                'seniority', s.seniority,
                'contract_types', s.contract_types,
                'locations', s.locations,
                'radius_km', s.radius_km,
                'remote', s.remote,
                'salary_min', s.salary_min,
                'max_age_days', s.max_age_days,
                'match_mode', 'domain',
                'focus_skills', '[]'::jsonb,
                'min_skills', 2
            )
        )
        FROM {SCHEMA}.search_criteria AS s
        WHERE s.profile_id = p.id
        """
    )
    op.drop_table("search_criteria", schema=SCHEMA)


def downgrade() -> None:
    op.create_table(
        "search_criteria",
        sa.Column(
            "profile_id",
            sa.Integer,
            sa.ForeignKey(f"{SCHEMA}.profiles.id", ondelete="CASCADE"),
            primary_key=True,
        ),
        sa.Column("roles", JSONB, nullable=False),
        sa.Column("technologies", JSONB, nullable=False, server_default=sa.text("'[]'::jsonb")),
        sa.Column(
            "excluded_keywords", JSONB, nullable=False, server_default=sa.text("'[]'::jsonb")
        ),
        sa.Column("seniority", sa.String(20), nullable=False),
        sa.Column("contract_types", JSONB, nullable=False, server_default=sa.text("'[]'::jsonb")),
        sa.Column("locations", JSONB, nullable=False, server_default=sa.text("'[]'::jsonb")),
        sa.Column("radius_km", sa.Integer, nullable=False),
        sa.Column("remote", sa.String(20), nullable=False),
        sa.Column("salary_min", sa.Integer),
        sa.Column("max_age_days", sa.Integer, nullable=False),
        schema=SCHEMA,
    )
    op.execute(
        f"""
        INSERT INTO {SCHEMA}.search_criteria
        SELECT p.id, s->'roles', s->'technologies', s->'excluded_keywords', s->>'seniority',
               s->'contract_types', s->'locations', (s->>'radius_km')::int, s->>'remote',
               (s->>'salary_min')::int, (s->>'max_age_days')::int
        FROM {SCHEMA}.profiles AS p, LATERAL (SELECT p.searches->0 AS s) AS first
        WHERE jsonb_array_length(p.searches) > 0
        """
    )
    for name in NEW_LISTS:
        op.drop_column("profiles", name, schema=SCHEMA)
