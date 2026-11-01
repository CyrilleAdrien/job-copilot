"""Un mail non distribué déjà lu n'allume plus le témoin du dossier Envoyés.

Revision ID: 0005
Revises: 0004
"""

import sqlalchemy as sa
from alembic import op

revision = "0005"
down_revision = "0004"
branch_labels = None
depends_on = None

SCHEMA = "mail"


def upgrade() -> None:
    op.add_column(
        "replies",
        sa.Column("problem_seen", sa.Boolean, nullable=False, server_default=sa.false()),
        schema=SCHEMA,
    )


def downgrade() -> None:
    op.drop_column("replies", "problem_seen", schema=SCHEMA)
