"""Add tech_stack to projects

Revision ID: 3e7c2f6a0b1d
Revises: b9a1c4f0f3a2
Create Date: 2026-02-03 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = '3e7c2f6a0b1d'
down_revision: Union[str, Sequence[str], None] = 'b9a1c4f0f3a2'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('projects', sa.Column('tech_stack', sa.String(length=255), nullable=True))


def downgrade() -> None:
    op.drop_column('projects', 'tech_stack')
