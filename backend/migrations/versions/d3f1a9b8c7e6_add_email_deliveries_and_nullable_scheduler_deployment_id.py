"""add email_deliveries and allow scheduled_jobs.deployment_id nullable

Revision ID: d3f1a9b8c7e6
Revises: c9e5f2a1b7d3
Create Date: 2026-02-19 12:20:00.000000
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = "d3f1a9b8c7e6"
down_revision: Union[str, Sequence[str], None] = "c9e5f2a1b7d3"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "email_deliveries",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("project_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("email_type", sa.String(length=40), nullable=False),
        sa.Column("dedupe_key", sa.String(length=255), nullable=False),
        sa.Column("status", sa.String(length=20), nullable=False, server_default="queued"),
        sa.Column("provider_message_id", sa.String(length=255), nullable=True),
        sa.Column("payload_json", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column("sent_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.ForeignKeyConstraint(["project_id"], ["projects.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )

    op.create_index("ix_email_deliveries_user_id", "email_deliveries", ["user_id"], unique=False)
    op.create_index("ix_email_deliveries_project_id", "email_deliveries", ["project_id"], unique=False)
    op.create_index("ix_email_deliveries_email_type", "email_deliveries", ["email_type"], unique=False)
    op.create_index("ix_email_deliveries_created_at", "email_deliveries", ["created_at"], unique=False)
    op.create_index("ix_email_deliveries_sent_at", "email_deliveries", ["sent_at"], unique=False)
    op.create_index("uq_email_deliveries_dedupe_key", "email_deliveries", ["dedupe_key"], unique=True)

    op.alter_column(
        "scheduled_jobs",
        "deployment_id",
        existing_type=postgresql.UUID(as_uuid=True),
        nullable=True,
    )


def downgrade() -> None:
    op.execute("DELETE FROM scheduled_jobs WHERE deployment_id IS NULL")

    op.alter_column(
        "scheduled_jobs",
        "deployment_id",
        existing_type=postgresql.UUID(as_uuid=True),
        nullable=False,
    )

    op.drop_index("uq_email_deliveries_dedupe_key", table_name="email_deliveries")
    op.drop_index("ix_email_deliveries_sent_at", table_name="email_deliveries")
    op.drop_index("ix_email_deliveries_created_at", table_name="email_deliveries")
    op.drop_index("ix_email_deliveries_email_type", table_name="email_deliveries")
    op.drop_index("ix_email_deliveries_project_id", table_name="email_deliveries")
    op.drop_index("ix_email_deliveries_user_id", table_name="email_deliveries")
    op.drop_table("email_deliveries")
