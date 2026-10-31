"""Candidatures et historique des statuts.

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

SCHEMA = "applications"


def upgrade() -> None:
    op.create_table(
        "applications",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("offer_id", sa.Integer, unique=True),
        sa.Column("search_id", sa.String(40)),
        sa.Column("title", sa.String(300), nullable=False),
        sa.Column("company", sa.String(200)),
        sa.Column("location", sa.String(200)),
        sa.Column("url", sa.String(1000)),
        sa.Column("source", sa.String(30)),
        sa.Column("description", sa.Text),
        sa.Column("contact_email", sa.String(320)),
        sa.Column("status", sa.String(20), nullable=False, server_default="draft"),
        sa.Column("applied_at", sa.DateTime(timezone=True)),
        sa.Column("cv_document_id", UUID(as_uuid=True)),
        sa.Column("letter_document_id", UUID(as_uuid=True)),
        sa.Column("notes", sa.Text, nullable=False, server_default=""),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        schema=SCHEMA,
    )
    op.create_index("ix_applications_status", "applications", ["status"], schema=SCHEMA)
    op.create_table(
        "status_events",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column(
            "application_id",
            UUID(as_uuid=True),
            sa.ForeignKey(f"{SCHEMA}.applications.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("from_status", sa.String(20)),
        sa.Column("to_status", sa.String(20), nullable=False),
        sa.Column("source", sa.String(20), nullable=False, server_default="manual"),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        schema=SCHEMA,
    )
    op.create_index(
        "ix_status_events_application_id", "status_events", ["application_id"], schema=SCHEMA
    )


def downgrade() -> None:
    op.drop_table("status_events", schema=SCHEMA)
    op.drop_table("applications", schema=SCHEMA)
