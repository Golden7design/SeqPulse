"""Add SDH hints table

Revision ID: b9a1c4f0f3a2
Revises: f8ca307bf82a
Create Date: 2026-02-03 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = 'b9a1c4f0f3a2'
down_revision: Union[str, Sequence[str], None] = 'f8ca307bf82a'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'sdh_hints',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('deployment_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('metric', sa.String(length=50), nullable=False),
        sa.Column('severity', sa.String(length=20), nullable=False),
        sa.Column('observed_value', sa.Float(), nullable=False),
        sa.Column('threshold', sa.Float(), nullable=False),
        sa.Column('title', sa.String(length=255), nullable=False),
        sa.Column('diagnosis', sa.Text(), nullable=False),
        sa.Column('suggested_actions', postgresql.ARRAY(sa.String()), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['deployment_id'], ['deployments.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_sdh_hints_deployment_id'), 'sdh_hints', ['deployment_id'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_sdh_hints_deployment_id'), table_name='sdh_hints')
    op.drop_table('sdh_hints')
