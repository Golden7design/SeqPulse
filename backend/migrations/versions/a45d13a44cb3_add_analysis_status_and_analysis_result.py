"""Add analysis_status and analysis_result

Revision ID: a45d13a44cb3
Revises: fae9a0fc24f8
Create Date: 2026-01-17 23:52:29.356888

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a45d13a44cb3'
down_revision: Union[str, Sequence[str], None] = 'fae9a0fc24f8'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Ajouter d'abord la colonne avec une valeur par défaut temporaire
    op.add_column(
        'deployments',
        sa.Column('analysis_status', sa.String(length=50), nullable=False, server_default='pending')
    )
    op.add_column(
        'deployments',
        sa.Column('analysis_result', sa.String(length=50), nullable=True)
    )

    # Optionnel : supprimer le server_default après l'ajout (meilleure pratique)
    op.alter_column('deployments', 'analysis_status', server_default=None)


def downgrade() -> None:
    op.drop_column('deployments', 'analysis_result')
    op.drop_column('deployments', 'analysis_status')