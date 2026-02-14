"""Make SDH observed/threshold nullable

Revision ID: 8d2f9c6a7b1e
Revises: 5b3c1f2d8a4e
Create Date: 2026-02-03 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = '8d2f9c6a7b1e'
down_revision: Union[str, Sequence[str], None] = '5b3c1f2d8a4e'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.alter_column('sdh_hints', 'observed_value', existing_type=sa.Float(), nullable=True)
    op.alter_column('sdh_hints', 'threshold', existing_type=sa.Float(), nullable=True)


def downgrade() -> None:
    op.alter_column('sdh_hints', 'threshold', existing_type=sa.Float(), nullable=False)
    op.alter_column('sdh_hints', 'observed_value', existing_type=sa.Float(), nullable=False)
