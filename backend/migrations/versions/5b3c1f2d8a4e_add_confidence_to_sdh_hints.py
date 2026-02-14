"""Add confidence to sdh_hints

Revision ID: 5b3c1f2d8a4e
Revises: 3e7c2f6a0b1d
Create Date: 2026-02-03 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = '5b3c1f2d8a4e'
down_revision: Union[str, Sequence[str], None] = '3e7c2f6a0b1d'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        'sdh_hints',
        sa.Column('confidence', sa.Float(), nullable=False, server_default=sa.text('0.5'))
    )
    op.alter_column('sdh_hints', 'confidence', server_default=None)


def downgrade() -> None:
    op.drop_column('sdh_hints', 'confidence')
