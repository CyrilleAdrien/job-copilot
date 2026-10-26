"""Générations et documents produits.

Revision ID: 0001
Revises:
"""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import JSONB, UUID

revision = "0001"
down_revision = None
branch_labels = None
depends_on = None

SCHEMA = "documents"


def upgrade() -> None:
    op.create_table(
        "generations",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("offer_id", sa.Integer, nullable=False),
        sa.Column("offer_title", sa.String(300)),
        sa.Column("company", sa.String(200)),
        sa.Column("language", sa.String(2)),
        sa.Column("with_letter", sa.Boolean, nullable=False),
        sa.Column("status", sa.String(10), nullable=False),
        sa.Column("step", sa.Integer, nullable=False),
        sa.Column("error", sa.Text),
        sa.Column("warnings", JSONB, nullable=False, server_default=sa.text("'[]'::jsonb")),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()
        ),
        schema=SCHEMA,
    )
    op.create_index("ix_generations_offer_id", "generations", ["offer_id"], schema=SCHEMA)
    op.create_table(
        "documents",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "generation_id",
            UUID(as_uuid=True),
            sa.ForeignKey(f"{SCHEMA}.generations.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("offer_id", sa.Integer, nullable=False),
        sa.Column("kind", sa.String(10), nullable=False),
        sa.Column("language", sa.String(2), nullable=False),
        sa.Column("template", sa.String(40), nullable=False),
        sa.Column("version", sa.Integer, nullable=False),
        sa.Column("pages", sa.Integer, nullable=False),
        sa.Column("s3_key", sa.String(300), nullable=False),
        sa.Column("content", JSONB, nullable=False),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()
        ),
        schema=SCHEMA,
    )


def downgrade() -> None:
    op.drop_table("documents", schema=SCHEMA)
    op.drop_table("generations", schema=SCHEMA)
