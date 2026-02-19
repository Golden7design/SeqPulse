"""add twofa fields and auth_challenges table

Revision ID: c9e5f2a1b7d3
Revises: a6f4b9d2c781
Create Date: 2026-02-17 18:10:00.000000
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = "c9e5f2a1b7d3"
down_revision: Union[str, Sequence[str], None] = "a6f4b9d2c781"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column("twofa_enabled", sa.Boolean(), nullable=False, server_default=sa.text("false")),
    )
    op.add_column("users", sa.Column("twofa_secret_encrypted", sa.String(), nullable=True))
    op.add_column("users", sa.Column("twofa_enabled_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("users", sa.Column("twofa_last_verified_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("users", sa.Column("twofa_recovery_codes_hash", sa.JSON(), nullable=True))
    op.add_column("users", sa.Column("twofa_last_totp_step", sa.BigInteger(), nullable=True))

    op.create_table(
        "auth_challenges",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("kind", sa.String(length=32), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("attempt_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("max_attempts", sa.Integer(), nullable=False, server_default="5"),
        sa.Column("consumed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("ip", sa.String(length=64), nullable=True),
        sa.Column("user_agent", sa.String(length=512), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_auth_challenges_user_id", "auth_challenges", ["user_id"], unique=False)
    op.create_index("ix_auth_challenges_kind", "auth_challenges", ["kind"], unique=False)
    op.create_index("ix_auth_challenges_expires_at", "auth_challenges", ["expires_at"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_auth_challenges_expires_at", table_name="auth_challenges")
    op.drop_index("ix_auth_challenges_kind", table_name="auth_challenges")
    op.drop_index("ix_auth_challenges_user_id", table_name="auth_challenges")
    op.drop_table("auth_challenges")

    op.drop_column("users", "twofa_last_totp_step")
    op.drop_column("users", "twofa_recovery_codes_hash")
    op.drop_column("users", "twofa_last_verified_at")
    op.drop_column("users", "twofa_enabled_at")
    op.drop_column("users", "twofa_secret_encrypted")
    op.drop_column("users", "twofa_enabled")
