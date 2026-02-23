"""add sdh audit fields

Revision ID: b1c2d3e4f5a6
Revises: e8b1c2d3f4a5
Create Date: 2026-02-22 12:00:00.000000
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "b1c2d3e4f5a6"
down_revision: Union[str, Sequence[str], None] = "e8b1c2d3f4a5"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("sdh_hints", sa.Column("secured_threshold", sa.Float(), nullable=True))
    op.add_column("sdh_hints", sa.Column("exceed_ratio", sa.Float(), nullable=True))
    op.add_column("sdh_hints", sa.Column("tolerance", sa.Float(), nullable=True))


def downgrade() -> None:
    op.drop_column("sdh_hints", "tolerance")
    op.drop_column("sdh_hints", "exceed_ratio")
    op.drop_column("sdh_hints", "secured_threshold")
