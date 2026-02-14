"""Add read-optimized indexes for dashboards and scheduler

Revision ID: c1b2a3d4e5f6
Revises: add_job_metadata
Create Date: 2026-02-06 15:05:00.000000
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "c1b2a3d4e5f6"
down_revision: Union[str, Sequence[str], None] = "add_job_metadata"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # deployments
    op.create_index(
        "ix_deployments_project_started_at",
        "deployments",
        ["project_id", "started_at"],
        unique=False,
    )
    op.create_index(
        "ix_deployments_state",
        "deployments",
        ["state"],
        unique=False,
    )

    # metric_samples
    op.create_index(
        "ix_metric_samples_deployment_phase_collected_at",
        "metric_samples",
        ["deployment_id", "phase", "collected_at"],
        unique=False,
    )

    # sdh_hints
    op.create_index(
        "ix_sdh_hints_severity",
        "sdh_hints",
        ["severity"],
        unique=False,
    )
    op.create_index(
        "ix_sdh_hints_created_at",
        "sdh_hints",
        ["created_at"],
        unique=False,
    )

    # projects
    op.create_index(
        "ix_projects_owner_id",
        "projects",
        ["owner_id"],
        unique=False,
    )

    # scheduled_jobs
    op.create_index(
        "ix_scheduled_jobs_status_scheduled_at",
        "scheduled_jobs",
        ["status", "scheduled_at"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index("ix_scheduled_jobs_status_scheduled_at", table_name="scheduled_jobs")
    op.drop_index("ix_projects_owner_id", table_name="projects")
    op.drop_index("ix_sdh_hints_created_at", table_name="sdh_hints")
    op.drop_index("ix_sdh_hints_severity", table_name="sdh_hints")
    op.drop_index(
        "ix_metric_samples_deployment_phase_collected_at",
        table_name="metric_samples",
    )
    op.drop_index("ix_deployments_state", table_name="deployments")
    op.drop_index("ix_deployments_project_started_at", table_name="deployments")
