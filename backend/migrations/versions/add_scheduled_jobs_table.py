"""Add scheduled_jobs table for persistent scheduler

Revision ID: add_scheduled_jobs
Revises: 8d2f9c6a7b1e
Create Date: 2026-02-06 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = 'add_scheduled_jobs'
down_revision: Union[str, Sequence[str], None] = '8d2f9c6a7b1e'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'scheduled_jobs',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('deployment_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('job_type', sa.String(length=50), nullable=False),
        sa.Column('phase', sa.String(length=20), nullable=True),
        sa.Column('sequence_index', sa.Integer(), nullable=True),
        sa.Column('scheduled_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('status', sa.String(length=20), nullable=False, server_default='pending'),
        sa.Column('retry_count', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('last_error', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), onupdate=sa.text('now()'), nullable=True),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_scheduled_jobs_deployment_id'), 'scheduled_jobs', ['deployment_id'], unique=False)
    op.create_index(op.f('ix_scheduled_jobs_scheduled_at'), 'scheduled_jobs', ['scheduled_at'], unique=False)
    op.create_index(op.f('ix_scheduled_jobs_status'), 'scheduled_jobs', ['status'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_scheduled_jobs_status'), table_name='scheduled_jobs')
    op.drop_index(op.f('ix_scheduled_jobs_scheduled_at'), table_name='scheduled_jobs')
    op.drop_index(op.f('ix_scheduled_jobs_deployment_id'), table_name='scheduled_jobs')
    op.drop_table('scheduled_jobs')