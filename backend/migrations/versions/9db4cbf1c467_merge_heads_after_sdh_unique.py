"""merge heads after sdh unique

Revision ID: 9db4cbf1c467
Revises: 2c7c1f8c3a10, 4f31e6a9b2cd
Create Date: 2026-04-04 15:25:56.736608

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '9db4cbf1c467'
down_revision: Union[str, Sequence[str], None] = ('2c7c1f8c3a10', '4f31e6a9b2cd')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    pass


def downgrade() -> None:
    """Downgrade schema."""
    pass
