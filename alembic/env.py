"""
CloudMind AI — Alembic Environment Configuration
─────────────────────────────────────────────────
Handles online and offline migration modes.
Reads DATABASE_URL from environment for production support.

Usage:
  # Create new migration from model changes:
  alembic revision --autogenerate -m "description_of_changes"

  # Apply pending migrations:
  alembic upgrade head

  # Roll back one migration:
  alembic downgrade -1

  # View current revision:
  alembic current
"""

import os
import sys
from logging.config import fileConfig

from sqlalchemy import engine_from_config, pool
from alembic import context

# ── Add backend to path so we can import models ─────────────────────────────
_BACKEND_DIR = os.path.join(os.path.dirname(__file__), "..", "backend")
sys.path.insert(0, _BACKEND_DIR)

# ── Import the SQLAlchemy metadata from our models ───────────────────────────
from database import Base  # noqa: E402

# ── Alembic config object ─────────────────────────────────────────────────────
config = context.config

# ── Read DATABASE_URL from environment (override alembic.ini for production) ──
_db_url = os.getenv("DATABASE_URL")
if _db_url:
    config.set_main_option("sqlalchemy.url", _db_url)

# ── Set up Python logging ─────────────────────────────────────────────────────
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# ── Target the application metadata for autogenerate support ─────────────────
target_metadata = Base.metadata


def run_migrations_offline() -> None:
    """
    Run migrations in 'offline' mode (no DB connection needed).

    Generates SQL scripts that can be reviewed and applied manually.
    Useful for reviewing changes before applying to production.
    """
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url            = url,
        target_metadata= target_metadata,
        literal_binds  = True,
        dialect_opts   = {"paramstyle": "named"},
        compare_type   = True,   # detect column type changes
        compare_server_default = True,
    )

    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    """
    Run migrations in 'online' mode (with live DB connection).

    Connects to the database and applies pending migrations directly.
    Used for development and CI/CD pipelines.
    """
    # Handle SQLite's check_same_thread requirement
    url = config.get_main_option("sqlalchemy.url", "")
    connect_args = {"check_same_thread": False} if url.startswith("sqlite") else {}

    connectable = engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix         = "sqlalchemy.",
        poolclass      = pool.NullPool,    # no pool needed for migrations
        connect_args   = connect_args,
    )

    with connectable.connect() as connection:
        context.configure(
            connection     = connection,
            target_metadata= target_metadata,
            compare_type   = True,
            compare_server_default = True,
        )
        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
