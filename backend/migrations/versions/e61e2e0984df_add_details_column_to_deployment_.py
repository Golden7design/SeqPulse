"""Add details column to deployment_verdicts

Revision ID: e61e2e0984df
Revises: 573408836483
Create Date: 2026-01-22 18:29:35.291946

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = 'e61e2e0984df'
down_revision: Union[str, Sequence[str], None] = '573408836483'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Ajouter la colonne 'details' (tableau de strings)
    op.add_column(
        'deployment_verdicts',
        sa.Column('details', postgresql.ARRAY(sa.String()), nullable=True)
    )
    
    # Garder les autres modifications existantes
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
    op.alter_column('metric_samples', 'requests_per_sec',
                   existing_type=sa.DOUBLE_PRECISION(precision=53),
                   nullable=False)
    op.alter_column('metric_samples', 'latency_p95',
                   existing_type=sa.DOUBLE_PRECISION(precision=53),
                   nullable=False)
    op.alter_column('metric_samples', 'error_rate',
                   existing_type=sa.DOUBLE_PRECISION(precision=53),
                   nullable=False)
    op.alter_column('metric_samples', 'cpu_usage',
                   existing_type=sa.DOUBLE_PRECISION(precision=53),
                   nullable=False)
    op.alter_column('metric_samples', 'memory_usage',
                   existing_type=sa.DOUBLE_PRECISION(precision=53),
                   nullable=False)

def downgrade() -> None:
    op.add_column('metric_samples', sa.Column('is_archived', sa.BOOLEAN(), server_default=sa.text('false'), nullable=True))
    op.alter_column('metric_samples', 'memory_usage',
                   existing_type=sa.DOUBLE_PRECISION(precision=53),
                   nullable=True)
    op.alter_column('metric_samples', 'cpu_usage',
                   existing_type=sa.DOUBLE_PRECISION(precision=53),
                   nullable=True)
    op.alter_column('metric_samples', 'error_rate',
                   existing_type=sa.DOUBLE_PRECISION(precision=53),
                   nullable=True)
    op.alter_column('metric_samples', 'latency_p95',
                   existing_type=sa.DOUBLE_PRECISION(precision=53),
                   nullable=True)
    op.alter_column('metric_samples', 'requests_per_sec',
                   existing_type=sa.DOUBLE_PRECISION(precision=53),
                   nullable=True)
    op.alter_column('metric_samples', 'phase',
                   existing_type=sa.VARCHAR(length=10),
                   nullable=True)
    op.alter_column('deployments', 'pipeline_result',
                   existing_type=sa.String(length=20),
                   type_=sa.VARCHAR(length=50),
                   existing_nullable=True)
    op.alter_column('deployment_verdicts', 'created_at',
                   existing_type=postgresql.TIMESTAMP(timezone=True),
                   nullable=True,
                   existing_server_default=sa.text('now()'))
    op.drop_column('deployment_verdicts', 'details')