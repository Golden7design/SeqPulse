"""replace commit_sha with idempotency_key and add running/metrics invariants

Revision ID: idempotency_key_002
Revises: add_idempotence_001
Create Date: 2026-02-10 10:15:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "idempotency_key_002"
down_revision = "add_idempotence_001"
depends_on = None


def upgrade():
    # Remove commit_sha idempotence
    op.drop_constraint("uq_deployments_project_env_commit", "deployments", type_="unique")
    op.drop_index("ix_deployments_commit_sha", table_name="deployments")
    op.drop_column("deployments", "commit_sha")

    # Add idempotency_key (opaque)
    op.add_column("deployments", sa.Column("idempotency_key", sa.String(255), nullable=True))

    # One running deployment per (project_id, env)
    op.create_index(
        "uq_running_deployment",
        "deployments",
        ["project_id", "env"],
        unique=True,
        postgresql_where=sa.text("state = 'running'"),
    )

    # Optional unique idempotency_key
    op.create_index(
        "uq_deployments_idempotency_key",
        "deployments",
        ["idempotency_key"],
        unique=True,
        postgresql_where=sa.text("idempotency_key IS NOT NULL"),
    )

    # Prevent duplicate metric samples
    op.create_index(
        "uq_metric_sample",
        "metric_samples",
        ["deployment_id", "phase", "collected_at"],
        unique=True,
    )


def downgrade():
    op.drop_index("uq_metric_sample", table_name="metric_samples")
    op.drop_index("uq_deployments_idempotency_key", table_name="deployments")
    op.drop_index("uq_running_deployment", table_name="deployments")

    op.drop_column("deployments", "idempotency_key")

    op.add_column("deployments", sa.Column("commit_sha", sa.String(40), nullable=True))
    op.create_index("ix_deployments_commit_sha", "deployments", ["commit_sha"])
    op.create_unique_constraint(
        "uq_deployments_project_env_commit",
        "deployments",
        ["project_id", "env", "commit_sha"],
    )
