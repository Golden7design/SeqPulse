"""merge heads

Revision ID: cf1ff4a57a64
Revises: b1c2d3e4f5a6, c5d2a1b4e7f8
Create Date: 2026-02-22 21:47:28.673387

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'cf1ff4a57a64'
down_revision: Union[str, Sequence[str], None] = ('b1c2d3e4f5a6', 'c5d2a1b4e7f8')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    pass


def downgrade() -> None:
    """Downgrade schema."""
    pass
