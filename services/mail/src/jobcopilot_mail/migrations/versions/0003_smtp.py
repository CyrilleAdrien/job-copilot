"""Serveur d'envoi par boîte, état des réponses et adresse de réponse des mails.

Revision ID: 0003
Revises: 0002
"""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import UUID

revision = "0003"
down_revision = "0002"
branch_labels = None
depends_on = None

SCHEMA = "mail"


def upgrade() -> None:
    op.add_column("accounts", sa.Column("smtp_host", sa.String(200)), schema=SCHEMA)
    op.add_column("accounts", sa.Column("smtp_port", sa.Integer), schema=SCHEMA)
    op.add_column(
        "accounts", sa.Column("smtp_checked_at", sa.DateTime(timezone=True)), schema=SCHEMA
    )
    op.add_column("accounts", sa.Column("smtp_error", sa.Text), schema=SCHEMA)
    op.add_column("messages", sa.Column("reply_to", sa.String(320)), schema=SCHEMA)
    # Les réponses déjà enregistrées sont parties : le serveur les avait acceptées.
    op.add_column(
        "replies",
        sa.Column("status", sa.String(12), nullable=False, server_default="sent"),
        schema=SCHEMA,
    )
    op.add_column("replies", sa.Column("error", sa.Text), schema=SCHEMA)
    op.add_column("replies", sa.Column("client_key", UUID(as_uuid=True)), schema=SCHEMA)
    op.create_unique_constraint(
        "replies_message_client_key", "replies", ["message_id", "client_key"], schema=SCHEMA
    )


def downgrade() -> None:
    op.drop_constraint("replies_message_client_key", "replies", schema=SCHEMA)
    for column in ("client_key", "error", "status"):
        op.drop_column("replies", column, schema=SCHEMA)
    op.drop_column("messages", "reply_to", schema=SCHEMA)
    for column in ("smtp_error", "smtp_checked_at", "smtp_port", "smtp_host"):
        op.drop_column("accounts", column, schema=SCHEMA)
