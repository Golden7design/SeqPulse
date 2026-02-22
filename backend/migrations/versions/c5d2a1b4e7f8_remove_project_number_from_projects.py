"""remove project_number from projects

Revision ID: c5d2a1b4e7f8
Revises: e8b1c2d3f4a5
Create Date: 2026-02-22 18:20:00.000000
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "c5d2a1b4e7f8"
down_revision: Union[str, Sequence[str], None] = "e8b1c2d3f4a5"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.drop_constraint("uq_projects_project_number", "projects", type_="unique")
    op.drop_column("projects", "project_number")
    op.execute("DROP SEQUENCE IF EXISTS project_number_seq")


def downgrade() -> None:
    op.execute("CREATE SEQUENCE IF NOT EXISTS project_number_seq AS BIGINT START WITH 1 INCREMENT BY 1")
    op.add_column(
        "projects",
        sa.Column(
            "project_number",
            sa.BigInteger(),
            nullable=True,
            server_default=sa.text("nextval('project_number_seq')"),
        ),
    )
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
        "SELECT setval('project_number_seq', COALESCE((SELECT MAX(project_number) FROM projects), 0) + 1, false)"
    )
    op.alter_column("projects", "project_number", nullable=False)
    op.create_unique_constraint("uq_projects_project_number", "projects", ["project_number"])
