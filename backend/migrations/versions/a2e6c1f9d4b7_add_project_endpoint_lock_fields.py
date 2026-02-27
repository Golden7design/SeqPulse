"""add project endpoint lock fields

Revision ID: a2e6c1f9d4b7
Revises: f2d4c6b8a901
Create Date: 2026-02-25 18:00:00.000000
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = "a2e6c1f9d4b7"
down_revision: Union[str, Sequence[str], None] = "f2d4c6b8a901"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("projects", sa.Column("metrics_endpoint_candidate", sa.String(length=2048), nullable=True))
    op.add_column("projects", sa.Column("metrics_endpoint_active", sa.String(length=2048), nullable=True))
    op.add_column(
        "projects",
        sa.Column(
            "endpoint_state",
            sa.String(length=32),
            nullable=False,
            server_default=sa.text("'pending_verification'"),
        ),
    )
    op.add_column("projects", sa.Column("endpoint_host_lock", sa.String(length=255), nullable=True))
    op.add_column(
        "projects",
        sa.Column("endpoint_change_count", sa.Integer(), nullable=False, server_default=sa.text("0")),
    )
    op.add_column(
        "projects",
        sa.Column("endpoint_migration_count", sa.Integer(), nullable=False, server_default=sa.text("0")),
    )
    op.add_column("projects", sa.Column("endpoint_last_verified_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("projects", sa.Column("endpoint_last_test_error_code", sa.String(length=64), nullable=True))
    op.add_column(
        "projects",
        sa.Column("baseline_version", sa.Integer(), nullable=False, server_default=sa.text("1")),
    )

    op.create_check_constraint(
        "ck_projects_endpoint_state",
        "projects",
        "endpoint_state IN ('pending_verification', 'active', 'blocked')",
    )

    op.create_table(
        "project_endpoint_events",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("project_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("actor_user_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("event_type", sa.String(length=64), nullable=False),
        sa.Column("event_payload", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.ForeignKeyConstraint(["actor_user_id"], ["users.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["project_id"], ["projects.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_project_endpoint_events_project_id",
        "project_endpoint_events",
        ["project_id"],
        unique=False,
    )
    op.create_index(
        "ix_project_endpoint_events_event_type",
        "project_endpoint_events",
        ["event_type"],
        unique=False,
    )
    op.create_index(
        "ix_project_endpoint_events_created_at",
        "project_endpoint_events",
        ["created_at"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index("ix_project_endpoint_events_created_at", table_name="project_endpoint_events")
    op.drop_index("ix_project_endpoint_events_event_type", table_name="project_endpoint_events")
    op.drop_index("ix_project_endpoint_events_project_id", table_name="project_endpoint_events")
    op.drop_table("project_endpoint_events")

    op.drop_constraint("ck_projects_endpoint_state", "projects", type_="check")

    op.drop_column("projects", "baseline_version")
    op.drop_column("projects", "endpoint_last_test_error_code")
    op.drop_column("projects", "endpoint_last_verified_at")
    op.drop_column("projects", "endpoint_migration_count")
    op.drop_column("projects", "endpoint_change_count")
    op.drop_column("projects", "endpoint_host_lock")
    op.drop_column("projects", "endpoint_state")
    op.drop_column("projects", "metrics_endpoint_active")
    op.drop_column("projects", "metrics_endpoint_candidate")
