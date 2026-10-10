import os
import sys
from logging.config import fileConfig

from sqlalchemy import engine_from_config
from sqlalchemy import pool

from alembic import context

# Add backend app directory to sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.core.config import settings
from app.database.base import Base
from app.models import (
    FoodItem,
    Meal,
    MealItem,
    User,
    UserProfile,
    DailyNutritionTarget,
)  # Ensure all models are loaded

# this is the Alembic Config object, which provides
# access to the values within the .ini file in use.
config = context.config

# Interpret the config file for Python logging.
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# Set database URL dynamically from app settings or environment, normalizing to postgresql+psycopg2://
raw_db_url = os.environ.get("DATABASE_URL") or settings.DATABASE_URL
effective_db_url = raw_db_url.replace("postgresql://", "postgresql+psycopg2://", 1) if raw_db_url.startswith("postgresql://") else raw_db_url
config.set_main_option("sqlalchemy.url", effective_db_url)

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
    configuration = config.get_section(config.config_ini_section, {})
    raw_url = os.environ.get("DATABASE_URL") or settings.DATABASE_URL
    effective_url = raw_url.replace("postgresql://", "postgresql+psycopg2://", 1) if raw_url.startswith("postgresql://") else raw_url
    configuration["sqlalchemy.url"] = effective_url

    connect_args = {}
    if effective_url.startswith("sqlite"):
        connect_args = {"check_same_thread": False}

    connectable = engine_from_config(
        configuration,
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
        connect_args=connect_args,
    )

    with connectable.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
            render_as_batch=True,
        )

        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
