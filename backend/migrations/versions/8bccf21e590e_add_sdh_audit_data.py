"""add sdh audit data

Revision ID: 8bccf21e590e
Revises: cf1ff4a57a64
Create Date: 2026-02-22 22:41:24.181452

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = '8bccf21e590e'
down_revision: Union[str, Sequence[str], None] = 'cf1ff4a57a64'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column("sdh_hints", sa.Column("audit_data", postgresql.JSONB(), nullable=True))


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column("sdh_hints", "audit_data")
