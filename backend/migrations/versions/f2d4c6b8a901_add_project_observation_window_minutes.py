"""add project observation window minutes

Revision ID: f2d4c6b8a901
Revises: 8bccf21e590e
Create Date: 2026-02-23 09:30:00.000000
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "f2d4c6b8a901"
down_revision: Union[str, Sequence[str], None] = "8bccf21e590e"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("projects", sa.Column("observation_window_minutes", sa.Integer(), nullable=True))


def downgrade() -> None:
    op.drop_column("projects", "observation_window_minutes")
