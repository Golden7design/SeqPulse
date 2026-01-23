"""Supprime les colonnes obsolètes de metric_samples (EAV legacy)

Revision ID: 174a24a2791d
Revises: 0fe6fc0b1e31
Create Date: 2026-01-21 23:58:09.946726

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = '174a24a2791d'
down_revision: Union[str, Sequence[str], None] = '0fe6fc0b1e31'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

def upgrade() -> None:
    # Supprimer les colonnes EAV obsolètes
    op.drop_column('metric_samples', 'name')
    op.drop_column('metric_samples', 'value')
    op.drop_column('metric_samples', 'window')
    op.drop_column('metric_samples', 'timestamp')


def downgrade() -> None:
    # Recréer les colonnes EAV (si nécessaire pour rollback)
    op.add_column('metric_samples', sa.Column('name', sa.String(100), nullable=False))
    op.add_column('metric_samples', sa.Column('value', sa.Float(), nullable=False))
    op.add_column('metric_samples', sa.Column('window', sa.String(50), nullable=False))
    op.add_column('metric_samples', sa.Column('timestamp', sa.DateTime(timezone=True), nullable=True))