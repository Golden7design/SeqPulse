"""ADD HMAC_SECRET in Projects

Revision ID: f8ca307bf82a
Revises: 307fd1fe72c1
Create Date: 2026-01-23 18:07:31.430136

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = 'f8ca307bf82a'
down_revision: Union[str, Sequence[str], None] = '307fd1fe72c1'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Ajouter la colonne comme nullable
    op.add_column(
        'projects',
        sa.Column('hmac_secret', sa.String(), nullable=True)
    )
    
    # 2. Générer un secret unique pour chaque projet existant
    from sqlalchemy import text
    from uuid import uuid4
    import secrets

    connection = op.get_bind()
    projects = connection.execute(text("SELECT id FROM projects")).fetchall()
    
    for (project_id,) in projects:
        secret = f"spm_{secrets.token_urlsafe(32)}"
        connection.execute(
            text("UPDATE projects SET hmac_secret = :secret WHERE id = :id"),
            {"secret": secret, "id": project_id}
        )
    
    # 3. Rendre la colonne NOT NULL et ajouter l'unicité
    op.alter_column('projects', 'hmac_secret', nullable=False)
    op.create_unique_constraint(None, 'projects', ['hmac_secret'])



def downgrade() -> None:
    op.drop_constraint(None, 'projects', type_='unique')
    op.drop_column('projects', 'hmac_secret')
    # ### end Alembic commands ###
