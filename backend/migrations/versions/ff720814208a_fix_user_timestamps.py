"""fix user timestamps

Revision ID: ff720814208a
Revises: c7fd62246f3f
Create Date: 2026-01-17 11:22:55.321241

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'ff720814208a'
down_revision: Union[str, Sequence[str], None] = 'c7fd62246f3f'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1Corriger les données existantes
    op.execute("""
        UPDATE users
        SET created_at = now()
        WHERE created_at IS NULL
    """)

    op.execute("""
        UPDATE users
        SET updated_at = now()
        WHERE updated_at IS NULL
    """)

    # Appliquer les contraintes et defaults
    op.alter_column(
        "users",
        "created_at",
        server_default=sa.text("now()"),
        nullable=False
    )

    op.alter_column(
        "users",
        "updated_at",
        server_default=sa.text("now()"),
        nullable=False
    )


def downgrade() -> None:
    op.alter_column("users", "created_at", nullable=True)
    op.alter_column("users", "updated_at", nullable=True)

