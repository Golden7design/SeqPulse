"""ADD HMAC in Project table

Revision ID: 307fd1fe72c1
Revises: e61e2e0984df
Create Date: 2026-01-23 13:54:12.146916

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = '307fd1fe72c1'
down_revision: Union[str, Sequence[str], None] = 'e61e2e0984df'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Ajouter la colonne comme nullable, avec une valeur par défaut
    op.add_column(
        'projects',
        sa.Column('hmac_enabled', sa.Boolean(), nullable=True, default=False)
    )
    
    # 2. Mettre à jour toutes les lignes existantes
    op.execute("UPDATE projects SET hmac_enabled = false WHERE hmac_enabled IS NULL")
    
    # 3. Rendre la colonne NOT NULL
    op.alter_column('projects', 'hmac_enabled', nullable=False)

def downgrade() -> None:
    op.drop_column('projects', 'hmac_enabled')