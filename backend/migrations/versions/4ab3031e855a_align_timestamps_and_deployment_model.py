"""align timestamps and deployment model

Revision ID: 4ab3031e855a
Revises: ff720814208a
Create Date: 2026-01-17 11:44:25.031848

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '4ab3031e855a'
down_revision: Union[str, Sequence[str], None] = 'ff720814208a'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    pass


def downgrade() -> None:
    """Downgrade schema."""
    pass
