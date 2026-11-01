"""Nouveaux messages (une réponse sans mail d'origine) et fil complet des conversations.

Revision ID: 0004
Revises: 0003
"""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import UUID

revision = "0004"
down_revision = "0003"
branch_labels = None
depends_on = None

SCHEMA = "mail"


def upgrade() -> None:
    op.add_column("messages", sa.Column("references", sa.Text), schema=SCHEMA)
    op.add_column("replies", sa.Column("account_id", UUID(as_uuid=True)), schema=SCHEMA)
    op.execute(
        "UPDATE mail.replies r SET account_id = m.account_id "
        "FROM mail.messages m WHERE r.message_id = m.id"
    )
    op.alter_column("replies", "account_id", nullable=False, schema=SCHEMA)
    op.create_foreign_key(
        "replies_account_id_fkey",
        "replies",
        "accounts",
        ["account_id"],
        ["id"],
        source_schema=SCHEMA,
        referent_schema=SCHEMA,
        ondelete="CASCADE",
    )
    op.create_index("ix_mail_replies_account_id", "replies", ["account_id"], schema=SCHEMA)
    op.alter_column("replies", "message_id", nullable=True, schema=SCHEMA)
    op.drop_constraint("replies_message_client_key", "replies", schema=SCHEMA)
    op.create_unique_constraint(
        "replies_account_client_key", "replies", ["account_id", "client_key"], schema=SCHEMA
    )


def downgrade() -> None:
    op.drop_constraint("replies_account_client_key", "replies", schema=SCHEMA)
    op.create_unique_constraint(
        "replies_message_client_key", "replies", ["message_id", "client_key"], schema=SCHEMA
    )
    # Un nouveau message n'a pas de place dans l'ancien schéma.
    op.execute("DELETE FROM mail.replies WHERE message_id IS NULL")
    op.alter_column("replies", "message_id", nullable=False, schema=SCHEMA)
    op.drop_index("ix_mail_replies_account_id", "replies", schema=SCHEMA)
    op.drop_constraint("replies_account_id_fkey", "replies", schema=SCHEMA)
    op.drop_column("replies", "account_id", schema=SCHEMA)
    op.drop_column("messages", "references", schema=SCHEMA)
