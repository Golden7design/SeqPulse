from logging.config import fileConfig
from sqlalchemy import engine_from_config, pool
from alembic import context
import sys
import os

# Ajoute le backend à sys.path pour que les imports fonctionnent
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

# Import Base declarative (qui contient tous les modèles)
from app.db.base import Base
from app.db.models import user, subscription, deployment, metric_sample, project, deployment_verdict, sdh_hint, auth_challenge  # importe tous les modèles pour les migrations

# Alembic Config object
config = context.config

# Setup logging from config
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# Importer ton Base pour autogenerate
target_metadata = Base.metadata

def run_migrations_offline() -> None:
    """Run migrations in 'offline' mode."""
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )

    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    """Run migrations in 'online' mode."""
    connectable = engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )

    with connectable.connect() as connection:
        context.configure(connection=connection, target_metadata=target_metadata)

        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
