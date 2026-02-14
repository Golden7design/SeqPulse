"""Add confidence column to deployment_verdicts

Revision ID: 573408836483
Revises: b702eff8d17e
Create Date: 2026-01-22 17:47:08.049588

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = '573408836483'
down_revision: Union[str, Sequence[str], None] = 'b702eff8d17e'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Ajouter confidence (NOT NULL, donc besoin d'une valeur par défaut temporaire)
    op.add_column(
        'deployment_verdicts',
        sa.Column('confidence', sa.Float(), nullable=False, server_default='1.0')
    )
    # Supprimer la valeur par défaut après ajout
    op.alter_column('deployment_verdicts', 'confidence', server_default=None)
    
    # Ajouter details (tableau de strings)
    op.add_column(
        'deployment_verdicts',
        sa.Column('details', postgresql.ARRAY(sa.String()), nullable=True)
    )
    
    # Autres modifications existantes
    op.alter_column('deployment_verdicts', 'created_at',
                   existing_type=postgresql.TIMESTAMP(timezone=True),
                   nullable=False,
                   existing_server_default=sa.text('now()'))
    op.alter_column('deployments', 'pipeline_result',
                   existing_type=sa.VARCHAR(length=50),
                   type_=sa.String(length=20),
                   existing_nullable=True)
    op.alter_column('metric_samples', 'phase',
                   existing_type=sa.VARCHAR(length=10),
                   nullable=False)
    # ... (gardez les autres ALTER COLUMN pour metric_samples)
    op.drop_column('metric_samples', 'is_archived')

def downgrade() -> None:
    op.add_column('metric_samples', sa.Column('is_archived', sa.BOOLEAN(), server_default=sa.text('false'), nullable=True))
    # ... (restaurez les autres colonnes metric_samples)
    op.alter_column('deployments', 'pipeline_result',
                   existing_type=sa.String(length=20),
                   type_=sa.VARCHAR(length=50),
                   existing_nullable=True)
    op.drop_column('deployment_verdicts', 'details')
    op.drop_column('deployment_verdicts', 'confidence')
    op.alter_column('deployment_verdicts', 'created_at',
                   existing_type=postgresql.TIMESTAMP(timezone=True),
                   nullable=True,
                   existing_server_default=sa.text('now()'))