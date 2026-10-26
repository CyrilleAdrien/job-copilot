"""Table des offres collectées.

Revision ID: 0001
Revises:
"""

import sqlalchemy as sa
from alembic import op

revision = "0001"
down_revision = None
branch_labels = None
depends_on = None

SCHEMA = "jobs"


def upgrade() -> None:
    op.create_table(
        "offers",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("source", sa.String(30), nullable=False),
        sa.Column("external_id", sa.String(120), nullable=False),
        sa.Column("dedup_key", sa.String(400), nullable=False),
        sa.Column("title", sa.String(300), nullable=False),
        sa.Column("company", sa.String(200)),
        sa.Column("location", sa.String(200)),
        sa.Column("contract", sa.String(20)),
        sa.Column("salary", sa.String(120)),
        sa.Column("description", sa.Text, nullable=False),
        sa.Column("url", sa.String(1000), nullable=False),
        sa.Column("published_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column(
            "fetched_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()
        ),
        sa.UniqueConstraint("source", "external_id", name="offers_source_external_id_key"),
        schema=SCHEMA,
    )
    op.create_index("ix_offers_dedup_key", "offers", ["dedup_key"], schema=SCHEMA)
    op.create_index("ix_offers_published_at", "offers", ["published_at"], schema=SCHEMA)


def downgrade() -> None:
    op.drop_table("offers", schema=SCHEMA)
