"""Comptes IMAP et mails liés aux candidatures.

Revision ID: 0001
Revises:
"""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import UUID

revision = "0001"
down_revision = None
branch_labels = None
depends_on = None

SCHEMA = "mail"


def upgrade() -> None:
    op.create_table(
        "accounts",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("email", sa.String(320), nullable=False),
        sa.Column("host", sa.String(200), nullable=False),
        sa.Column("port", sa.Integer, nullable=False, server_default="993"),
        sa.Column("username", sa.String(320), nullable=False),
        sa.Column("password_encrypted", sa.Text, nullable=False),
        sa.Column("folder", sa.String(200), nullable=False, server_default="INBOX"),
        sa.Column("last_uid", sa.Integer, nullable=False, server_default="0"),
        sa.Column("uid_validity", sa.Integer),
        sa.Column("last_sync_at", sa.DateTime(timezone=True)),
        sa.Column("last_error", sa.Text),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        schema=SCHEMA,
    )
    op.create_table(
        "messages",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "account_id",
            UUID(as_uuid=True),
            sa.ForeignKey(f"{SCHEMA}.accounts.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("message_id", sa.String(500), nullable=False),
        sa.Column("uid", sa.Integer, nullable=False),
        sa.Column("from_address", sa.String(320), nullable=False),
        sa.Column("from_name", sa.String(300)),
        sa.Column("subject", sa.String(500), nullable=False, server_default=""),
        sa.Column("received_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("snippet", sa.Text, nullable=False, server_default=""),
        sa.Column("category", sa.String(30), nullable=False, server_default="other"),
        sa.Column("confidence", sa.Float, nullable=False, server_default="0"),
        sa.Column("reason", sa.Text, nullable=False, server_default=""),
        sa.Column("application_id", UUID(as_uuid=True)),
        sa.Column("match_reason", sa.String(200)),
        sa.Column("suggested_status", sa.String(20)),
        sa.Column("status_applied", sa.Boolean, nullable=False, server_default=sa.false()),
        sa.Column("reviewed", sa.Boolean, nullable=False, server_default=sa.false()),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.UniqueConstraint("account_id", "message_id"),
        schema=SCHEMA,
    )
    op.create_index("ix_messages_account_id", "messages", ["account_id"], schema=SCHEMA)
    op.create_index("ix_messages_received_at", "messages", ["received_at"], schema=SCHEMA)
    op.create_index("ix_messages_application_id", "messages", ["application_id"], schema=SCHEMA)


def downgrade() -> None:
    op.drop_table("messages", schema=SCHEMA)
    op.drop_table("accounts", schema=SCHEMA)
