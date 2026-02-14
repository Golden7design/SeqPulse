"""scope deployment number per project

Revision ID: a6f4b9d2c781
Revises: 9f31d2ab7c11
Create Date: 2026-02-14 16:30:00.000000
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "a6f4b9d2c781"
down_revision: Union[str, Sequence[str], None] = "9f31d2ab7c11"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.drop_constraint("uq_deployments_deployment_number", "deployments", type_="unique")

    op.execute(
        """
        WITH ordered AS (
            SELECT id, row_number() OVER (PARTITION BY project_id ORDER BY started_at, id) AS rn
            FROM deployments
        )
        UPDATE deployments d
        SET deployment_number = ordered.rn
        FROM ordered
        WHERE d.id = ordered.id
        """
    )

    op.alter_column(
        "deployments",
        "deployment_number",
        existing_type=sa.BigInteger(),
        server_default=None,
        existing_nullable=False,
    )

    op.create_unique_constraint(
        "uq_deployments_project_deployment_number",
        "deployments",
        ["project_id", "deployment_number"],
    )

    op.execute("DROP SEQUENCE IF EXISTS deployment_number_seq")


def downgrade() -> None:
    op.execute("CREATE SEQUENCE IF NOT EXISTS deployment_number_seq AS BIGINT START WITH 1 INCREMENT BY 1")

    op.drop_constraint("uq_deployments_project_deployment_number", "deployments", type_="unique")

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
        """
    )

    op.execute(
        "SELECT setval('deployment_number_seq', COALESCE((SELECT MAX(deployment_number) FROM deployments), 0) + 1, false)"
    )

    op.alter_column(
        "deployments",
        "deployment_number",
        existing_type=sa.BigInteger(),
        server_default=sa.text("nextval('deployment_number_seq')"),
        existing_nullable=False,
    )

    op.create_unique_constraint("uq_deployments_deployment_number", "deployments", ["deployment_number"])
