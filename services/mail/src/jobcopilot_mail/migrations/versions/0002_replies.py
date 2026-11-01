"""Réponses envoyées depuis l'application.

Revision ID: 0002
Revises: 0001
"""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import UUID

revision = "0002"
down_revision = "0001"
branch_labels = None
depends_on = None

SCHEMA = "mail"


def upgrade() -> None:
    op.create_table(
        "replies",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "message_id",
            UUID(as_uuid=True),
            sa.ForeignKey(f"{SCHEMA}.messages.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("to_address", sa.String(320), nullable=False),
        sa.Column("subject", sa.String(500), nullable=False),
        sa.Column("body", sa.Text(), nullable=False),
        sa.Column("smtp_message_id", sa.String(500), nullable=False),
        sa.Column(
            "sent_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        schema=SCHEMA,
    )
    op.create_index("ix_replies_message_id", "replies", ["message_id"], schema=SCHEMA)


def downgrade() -> None:
    op.drop_table("replies", schema=SCHEMA)
