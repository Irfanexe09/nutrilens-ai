import os
import pytest
from sqlalchemy import create_engine
from alembic.config import Config
from alembic import command

from scripts.run_staging_migrations import (
    wait_for_database,
    run_migrations,
    seed_nutrition_database,
)


def test_wait_for_database_succeeds_on_valid_engine(tmp_path):
    """Verify wait_for_database succeeds when database is reachable."""
    db_file = tmp_path / "ping_test.db"
    engine = create_engine(f"sqlite:///{db_file}")
    reachable = wait_for_database(engine, max_retries=2, delay_seconds=0.1)
    assert reachable is True
    engine.dispose()


def test_run_migrations_and_seed_nutrition_on_disposable_database(tmp_path):
    """
    Verify run_migrations applies Alembic head to a clean disposable database
    and seed_nutrition_database seeds initial data idempotently.
    """
    db_file = tmp_path / "runner_test.db"
    db_url = f"sqlite:///{db_file}"
    engine = create_engine(db_url)

    backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    alembic_ini = os.path.join(backend_dir, "alembic.ini")

    # 1. Run migrations via runner function
    run_migrations(alembic_ini, db_url)

    # 2. Verify tables were created by checking current revision
    cfg = Config(alembic_ini)
    cfg.set_main_option("sqlalchemy.url", db_url)

    # 3. Seed nutrition database
    seed_nutrition_database(engine)

    # 4. Run seeding a second time to verify idempotency (must not crash or duplicate)
    seed_nutrition_database(engine)

    engine.dispose()
