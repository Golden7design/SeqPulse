"""add public numbers for projects and deployments

Revision ID: 9f31d2ab7c11
Revises: c1b2a3d4e5f6, idempotency_key_002
Create Date: 2026-02-14 13:45:00.000000
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "9f31d2ab7c11"
down_revision: Union[str, Sequence[str], None] = ("c1b2a3d4e5f6", "idempotency_key_002")
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("CREATE SEQUENCE IF NOT EXISTS project_number_seq AS BIGINT START WITH 1 INCREMENT BY 1")
    op.execute("CREATE SEQUENCE IF NOT EXISTS deployment_number_seq AS BIGINT START WITH 1 INCREMENT BY 1")

    op.add_column(
        "projects",
        sa.Column(
            "project_number",
            sa.BigInteger(),
            nullable=True,
            server_default=sa.text("nextval('project_number_seq')"),
        ),
    )
    op.add_column(
        "deployments",
        sa.Column(
            "deployment_number",
            sa.BigInteger(),
            nullable=True,
            server_default=sa.text("nextval('deployment_number_seq')"),
        ),
    )

    # Backfill existing rows in a deterministic order.
    op.execute(
        """
        WITH ordered AS (
            SELECT id, row_number() OVER (ORDER BY created_at, id) AS rn
            FROM projects
        )
        UPDATE projects p
        SET project_number = ordered.rn
        FROM ordered
        WHERE p.id = ordered.id
          AND p.project_number IS NULL
        """
    )
    op.execute(
        """
        WITH ordered AS (
            SELECT id, row_number() OVER (ORDER BY started_at, id) AS rn
            FROM deployments
        )
        UPDATE deployments d
        SET deployment_number = ordered.rn
        FROM ordered
        WHERE d.id = ordered.id
          AND d.deployment_number IS NULL
        """
    )

    op.execute(
        "SELECT setval('project_number_seq', COALESCE((SELECT MAX(project_number) FROM projects), 0) + 1, false)"
    )
    op.execute(
        "SELECT setval('deployment_number_seq', COALESCE((SELECT MAX(deployment_number) FROM deployments), 0) + 1, false)"
    )

    op.alter_column("projects", "project_number", nullable=False)
    op.alter_column("deployments", "deployment_number", nullable=False)

    op.create_unique_constraint("uq_projects_project_number", "projects", ["project_number"])
    op.create_unique_constraint("uq_deployments_deployment_number", "deployments", ["deployment_number"])

def downgrade() -> None:
    op.drop_constraint("uq_deployments_deployment_number", "deployments", type_="unique")
    op.drop_constraint("uq_projects_project_number", "projects", type_="unique")

    op.drop_column("deployments", "deployment_number")
    op.drop_column("projects", "project_number")

    op.execute("DROP SEQUENCE IF EXISTS deployment_number_seq")
    op.execute("DROP SEQUENCE IF EXISTS project_number_seq")
