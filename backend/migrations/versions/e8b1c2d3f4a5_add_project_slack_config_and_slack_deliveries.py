"""add project slack config and slack_deliveries

Revision ID: e8b1c2d3f4a5
Revises: d3f1a9b8c7e6, c1b2a3d4e5f6
Create Date: 2026-02-21 10:30:00.000000
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = "e8b1c2d3f4a5"
down_revision: Union[str, Sequence[str], None] = ("d3f1a9b8c7e6", "c1b2a3d4e5f6")
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "projects",
        sa.Column("slack_enabled", sa.Boolean(), nullable=False, server_default=sa.text("false")),
    )
    op.add_column("projects", sa.Column("slack_webhook_url", sa.String(length=1024), nullable=True))
    op.add_column("projects", sa.Column("slack_channel", sa.String(length=255), nullable=True))

    op.create_table(
        "slack_deliveries",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("project_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("notification_type", sa.String(length=40), nullable=False),
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

    op.create_index("ix_slack_deliveries_user_id", "slack_deliveries", ["user_id"], unique=False)
    op.create_index("ix_slack_deliveries_project_id", "slack_deliveries", ["project_id"], unique=False)
    op.create_index(
        "ix_slack_deliveries_notification_type",
        "slack_deliveries",
        ["notification_type"],
        unique=False,
    )
    op.create_index("ix_slack_deliveries_created_at", "slack_deliveries", ["created_at"], unique=False)
    op.create_index("ix_slack_deliveries_sent_at", "slack_deliveries", ["sent_at"], unique=False)
    op.create_index("uq_slack_deliveries_dedupe_key", "slack_deliveries", ["dedupe_key"], unique=True)


def downgrade() -> None:
    op.drop_index("uq_slack_deliveries_dedupe_key", table_name="slack_deliveries")
    op.drop_index("ix_slack_deliveries_sent_at", table_name="slack_deliveries")
    op.drop_index("ix_slack_deliveries_created_at", table_name="slack_deliveries")
    op.drop_index("ix_slack_deliveries_notification_type", table_name="slack_deliveries")
    op.drop_index("ix_slack_deliveries_project_id", table_name="slack_deliveries")
    op.drop_index("ix_slack_deliveries_user_id", table_name="slack_deliveries")
    op.drop_table("slack_deliveries")

    op.drop_column("projects", "slack_channel")
    op.drop_column("projects", "slack_webhook_url")
    op.drop_column("projects", "slack_enabled")

