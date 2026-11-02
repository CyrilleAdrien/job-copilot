"""Informations personnelles et sections de CV supplémentaires.

Revision ID: 0004
Revises: 0003
"""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import JSONB

revision = "0004"
down_revision = "0003"
branch_labels = None
depends_on = None

SCHEMA = "profile"
NEW_TEXTS = {"address": 200, "birth_date": 10, "nationality": 60, "driving_licence": 40}
NEW_LISTS = ("awards", "courses", "referees", "custom_sections")


def upgrade() -> None:
    for name, length in NEW_TEXTS.items():
        op.add_column("profiles", sa.Column(name, sa.String(length)), schema=SCHEMA)
    for name in NEW_LISTS:
        op.add_column(
            "profiles",
            sa.Column(name, JSONB, nullable=False, server_default=sa.text("'[]'::jsonb")),
            schema=SCHEMA,
        )


def downgrade() -> None:
    for name in (*NEW_LISTS, *NEW_TEXTS):
        op.drop_column("profiles", name, schema=SCHEMA)
