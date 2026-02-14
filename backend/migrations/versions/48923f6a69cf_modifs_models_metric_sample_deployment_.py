"""Modifs models metric_sample, deployment and Add deployment_verdict

Revision ID: 48923f6a69cf
Revises: a45d13a44cb3
Create Date: 2026-01-18 12:06:22.825779

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = '48923f6a69cf'
down_revision: Union[str, Sequence[str], None] = 'a45d13a44cb3'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # === 1. Renommer les colonnes existantes (au lieu de drop/add) ===
    op.alter_column('deployments', 'start_time', new_column_name='started_at')
    op.alter_column('deployments', 'end_time', new_column_name='finished_at')
    op.alter_column('deployments', 'duration_seconds', new_column_name='duration_ms')

    # Convertir seconds → milliseconds
    op.execute("UPDATE deployments SET duration_ms = duration_ms * 1000 WHERE duration_ms IS NOT NULL")

    # === 2. Corriger le type de duration_ms (int → int, mais s'assurer que c'est bien un entier) ===
    # (déjà int, donc pas de changement nécessaire)


    # === 3. Supprimer les anciennes colonnes d'analyse (si elles existent) ===
    # (elles ne sont pas utilisées dans le nouveau design)
    op.drop_column('deployments', 'analysis_result')
    op.drop_column('deployments', 'analysis_status')

    # === 4. Ajouter is_archived à metric_samples ===
    op.add_column('metric_samples', sa.Column('is_archived', sa.Boolean(), nullable=True, server_default=sa.text('false')))

    # === 5. Rendre timestamp NOT NULL (il l'était probablement déjà) ===
    op.alter_column('metric_samples', 'timestamp',
                    existing_type=postgresql.TIMESTAMP(timezone=True),
                    nullable=False,
                    existing_server_default=sa.text('now()'))

    # === 6. Supprimer 'source' (non utilisé dans le nouveau design) ===
    op.drop_column('metric_samples', 'source')


def downgrade() -> None:
    # Inverse des opérations ci-dessus
    op.add_column('metric_samples', sa.Column('source', sa.VARCHAR(length=50), nullable=True))
    op.alter_column('metric_samples', 'timestamp',
                    existing_type=postgresql.TIMESTAMP(timezone=True),
                    nullable=True,
                    existing_server_default=sa.text('now()'))
    op.drop_column('metric_samples', 'is_archived')

    op.add_column('deployments', sa.Column('analysis_status', sa.VARCHAR(length=50), nullable=False))
    op.add_column('deployments', sa.Column('analysis_result', sa.VARCHAR(length=50), nullable=True))
    op.alter_column('deployments', 'duration_ms', new_column_name='duration_seconds')
    op.alter_column('deployments', 'finished_at', new_column_name='end_time')
    op.alter_column('deployments', 'started_at', new_column_name='start_time')