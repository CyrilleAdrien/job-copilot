"""Offres favorites, propres à chaque profil de recherche.

Revision ID: 0002
Revises: 0001
"""

import sqlalchemy as sa
from alembic import op

revision = "0002"
down_revision = "0001"
branch_labels = None
depends_on = None

SCHEMA = "jobs"


def upgrade() -> None:
    op.create_table(
        "favorites",
        sa.Column("search_id", sa.String(40), primary_key=True),
        sa.Column(
            "offer_id",
            sa.Integer,
            sa.ForeignKey(f"{SCHEMA}.offers.id", ondelete="CASCADE"),
            primary_key=True,
        ),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        schema=SCHEMA,
    )


def downgrade() -> None:
    op.drop_table("favorites", schema=SCHEMA)
