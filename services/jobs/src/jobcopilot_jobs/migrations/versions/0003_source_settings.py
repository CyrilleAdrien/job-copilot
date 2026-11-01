"""Clés des sources saisies dans les réglages (chiffrées) et délai entre deux recherches.

Revision ID: 0003
Revises: 0002
"""

import sqlalchemy as sa
from alembic import op

revision = "0003"
down_revision = "0002"
branch_labels = None
depends_on = None

SCHEMA = "jobs"


def upgrade() -> None:
    op.create_table(
        "source_credentials",
        sa.Column("name", sa.String(30), primary_key=True),
        sa.Column("secret_id", sa.Text, nullable=False),
        sa.Column("secret_key", sa.Text, nullable=False),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        schema=SCHEMA,
    )
    op.create_table(
        "search_settings",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("refresh_minutes", sa.Integer, nullable=False),
        schema=SCHEMA,
    )


def downgrade() -> None:
    op.drop_table("search_settings", schema=SCHEMA)
    op.drop_table("source_credentials", schema=SCHEMA)
