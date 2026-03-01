"""add cascades for project deletion on deliveries and scheduled jobs

Revision ID: 4f31e6a9b2cd
Revises: a2e6c1f9d4b7
Create Date: 2026-03-01 10:45:00.000000
"""

from typing import Sequence, Union

from alembic import op


# revision identifiers, used by Alembic.
revision: str = "4f31e6a9b2cd"
down_revision: Union[str, Sequence[str], None] = "a2e6c1f9d4b7"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Ensure no invalid references before (re)creating constraints.
    op.execute(
        """
        UPDATE email_deliveries ed
        SET project_id = NULL
        WHERE ed.project_id IS NOT NULL
          AND NOT EXISTS (
            SELECT 1
            FROM projects p
            WHERE p.id = ed.project_id
          )
        """
    )
    op.execute(
        """
        UPDATE slack_deliveries sd
        SET project_id = NULL
        WHERE sd.project_id IS NOT NULL
          AND NOT EXISTS (
            SELECT 1
            FROM projects p
            WHERE p.id = sd.project_id
          )
        """
    )

    # email_deliveries.project_id: SET NULL -> CASCADE
    op.execute("ALTER TABLE email_deliveries DROP CONSTRAINT IF EXISTS fk_email_deliveries_project_id_projects")
    op.execute("ALTER TABLE email_deliveries DROP CONSTRAINT IF EXISTS email_deliveries_project_id_fkey")
    op.create_foreign_key(
        "fk_email_deliveries_project_id_projects",
        "email_deliveries",
        "projects",
        ["project_id"],
        ["id"],
        ondelete="CASCADE",
    )

    # slack_deliveries.project_id: SET NULL -> CASCADE
    op.execute("ALTER TABLE slack_deliveries DROP CONSTRAINT IF EXISTS fk_slack_deliveries_project_id_projects")
    op.execute("ALTER TABLE slack_deliveries DROP CONSTRAINT IF EXISTS slack_deliveries_project_id_fkey")
    op.create_foreign_key(
        "fk_slack_deliveries_project_id_projects",
        "slack_deliveries",
        "projects",
        ["project_id"],
        ["id"],
        ondelete="CASCADE",
    )

    # scheduled_jobs.deployment_id: add FK ON DELETE CASCADE
    op.execute(
        """
        DELETE FROM scheduled_jobs sj
        WHERE sj.deployment_id IS NOT NULL
          AND NOT EXISTS (
            SELECT 1
            FROM deployments d
            WHERE d.id = sj.deployment_id
          )
        """
    )
    op.execute("ALTER TABLE scheduled_jobs DROP CONSTRAINT IF EXISTS fk_scheduled_jobs_deployment_id_deployments")
    op.execute("ALTER TABLE scheduled_jobs DROP CONSTRAINT IF EXISTS scheduled_jobs_deployment_id_fkey")
    op.create_foreign_key(
        "fk_scheduled_jobs_deployment_id_deployments",
        "scheduled_jobs",
        "deployments",
        ["deployment_id"],
        ["id"],
        ondelete="CASCADE",
    )


def downgrade() -> None:
    # scheduled_jobs: remove cascade FK (restore previous state: no FK)
    op.execute("ALTER TABLE scheduled_jobs DROP CONSTRAINT IF EXISTS fk_scheduled_jobs_deployment_id_deployments")
    op.execute("ALTER TABLE scheduled_jobs DROP CONSTRAINT IF EXISTS scheduled_jobs_deployment_id_fkey")

    # email_deliveries: CASCADE -> SET NULL
    op.execute("ALTER TABLE email_deliveries DROP CONSTRAINT IF EXISTS fk_email_deliveries_project_id_projects")
    op.execute("ALTER TABLE email_deliveries DROP CONSTRAINT IF EXISTS email_deliveries_project_id_fkey")
    op.create_foreign_key(
        "email_deliveries_project_id_fkey",
        "email_deliveries",
        "projects",
        ["project_id"],
        ["id"],
        ondelete="SET NULL",
    )

    # slack_deliveries: CASCADE -> SET NULL
    op.execute("ALTER TABLE slack_deliveries DROP CONSTRAINT IF EXISTS fk_slack_deliveries_project_id_projects")
    op.execute("ALTER TABLE slack_deliveries DROP CONSTRAINT IF EXISTS slack_deliveries_project_id_fkey")
    op.create_foreign_key(
        "slack_deliveries_project_id_fkey",
        "slack_deliveries",
        "projects",
        ["project_id"],
        ["id"],
        ondelete="SET NULL",
    )
