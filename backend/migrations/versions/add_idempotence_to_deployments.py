"""add idempotence to deployments

Revision ID: add_idempotence_001
Revises: add_job_metadata
Create Date: 2026-02-07 00:22:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'add_idempotence_001'
down_revision = 'add_job_metadata'
depends_on = None


def upgrade():
    # Ajouter colonnes commit_sha et branch
    op.add_column('deployments', sa.Column('commit_sha', sa.String(40), nullable=True))
    op.add_column('deployments', sa.Column('branch', sa.String(255), nullable=True))
    
    # Remplir les valeurs existantes avec un placeholder
    # Pour les déploiements existants, on utilise 'legacy-{id}' pour éviter les conflits
    op.execute("""
        UPDATE deployments 
        SET commit_sha = 'legacy-' || CAST(id AS TEXT)
        WHERE commit_sha IS NULL
    """)
    
    # Rendre commit_sha obligatoire
    op.alter_column('deployments', 'commit_sha', nullable=False)
    
    # Créer index pour performance
    op.create_index('ix_deployments_commit_sha', 'deployments', ['commit_sha'])
    
    # Créer contrainte unique pour idempotence
    op.create_unique_constraint(
        'uq_deployments_project_env_commit',
        'deployments',
        ['project_id', 'env', 'commit_sha']
    )


def downgrade():
    # Supprimer contrainte unique
    op.drop_constraint('uq_deployments_project_env_commit', 'deployments', type_='unique')
    
    # Supprimer index
    op.drop_index('ix_deployments_commit_sha', 'deployments')
    
    # Supprimer colonnes
    op.drop_column('deployments', 'branch')
    op.drop_column('deployments', 'commit_sha')
