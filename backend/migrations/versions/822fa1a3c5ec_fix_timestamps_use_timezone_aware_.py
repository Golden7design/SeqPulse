"""fix timestamps: use timezone-aware DateTime with func.now()

Revision ID: 822fa1a3c5ec
Revises: 5af4b354608e
Create Date: 2026-01-16 14:12:17.485435

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = '822fa1a3c5ec'
down_revision: Union[str, Sequence[str], None] = '5af4b354608e'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # =========================
    # USERS
    # =========================
    op.execute("UPDATE users SET created_at = now() WHERE created_at IS NULL")
    op.execute("UPDATE users SET updated_at = now() WHERE updated_at IS NULL")

    op.alter_column('users', 'created_at', server_default=sa.text("now()"), nullable=False)
    op.alter_column('users', 'updated_at', server_default=sa.text("now()"), nullable=False)

    # =========================
    # PROJECTS
    # =========================
    op.execute("UPDATE projects SET created_at = now() WHERE created_at IS NULL")
    op.execute("UPDATE projects SET updated_at = now() WHERE updated_at IS NULL")

    op.alter_column('projects', 'created_at', server_default=sa.text("now()"), nullable=False)
    op.alter_column('projects', 'updated_at', server_default=sa.text("now()"), nullable=False)

    # =========================
    # SUBSCRIPTIONS
    # =========================
    op.execute("UPDATE subscriptions SET created_at = now() WHERE created_at IS NULL")
    op.execute("UPDATE subscriptions SET updated_at = now() WHERE updated_at IS NULL")

    op.alter_column('subscriptions', 'created_at', server_default=sa.text("now()"), nullable=False)
    op.alter_column('subscriptions', 'updated_at', server_default=sa.text("now()"), nullable=False)

    # =========================
    # DEPLOYMENTS
    # =========================
    op.execute("UPDATE deployments SET start_time = now() WHERE start_time IS NULL")
    # end_time reste nullable et sans default
    op.alter_column('deployments', 'start_time', server_default=sa.text("now()"), nullable=False)
    op.alter_column('deployments', 'end_time', server_default=None, nullable=True)

    # =========================
    # METRIC SAMPLES
    # =========================
    op.alter_column('metric_samples', 'timestamp', type_=sa.DateTime(timezone=True), existing_nullable=True)


def downgrade() -> None:
    # On peut juste retirer les server_default et remettre nullable
    op.alter_column('users', 'created_at', nullable=True, server_default=None)
    op.alter_column('users', 'updated_at', nullable=True, server_default=None)

    op.alter_column('projects', 'created_at', nullable=True, server_default=None)
    op.alter_column('projects', 'updated_at', nullable=True, server_default=None)

    op.alter_column('subscriptions', 'created_at', nullable=True, server_default=None)
    op.alter_column('subscriptions', 'updated_at', nullable=True, server_default=None)

    op.alter_column('deployments', 'start_time', nullable=True, server_default=None)
    op.alter_column('deployments', 'end_time', nullable=True, server_default=None)

    op.alter_column('metric_samples', 'timestamp', type_=postgresql.TIMESTAMP(), existing_nullable=True)

