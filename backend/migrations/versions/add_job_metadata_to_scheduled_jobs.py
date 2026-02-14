"""Add job_metadata column to scheduled_jobs for storing job parameters

Revision ID: add_job_metadata
Revises: add_scheduled_jobs
Create Date: 2026-02-06 12:10:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = 'add_job_metadata'
down_revision: Union[str, Sequence[str], None] = 'add_scheduled_jobs'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('scheduled_jobs', sa.Column('job_metadata', postgresql.JSONB(), nullable=True))


def downgrade() -> None:
    op.drop_column('scheduled_jobs', 'job_metadata')