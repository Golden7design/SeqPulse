"""add unique constraint on sdh_hints deployment_id metric

Revision ID: 2c7c1f8c3a10
Revises: fae9a0fc24f8
Create Date: 2026-04-04 13:20:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '2c7c1f8c3a10'
down_revision: Union[str, Sequence[str], None] = 'fae9a0fc24f8'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_unique_constraint(
        'uq_sdh_hints_deployment_metric',
        'sdh_hints',
        ['deployment_id', 'metric'],
    )


def downgrade() -> None:
    op.drop_constraint('uq_sdh_hints_deployment_metric', 'sdh_hints', type_='unique')
