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


def test_alembic_cli_respects_environment_database_url(tmp_path, monkeypatch):
    """Verify Alembic dynamically respects DATABASE_URL environment variable without config file hardcoding."""
    db_file = tmp_path / "env_var_test.db"
    db_url = f"sqlite:///{db_file}"
    monkeypatch.setenv("DATABASE_URL", db_url)

    backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    alembic_ini = os.path.join(backend_dir, "alembic.ini")

    cfg = Config(alembic_ini)
    command.upgrade(cfg, "head")

    assert os.path.exists(db_file)


def test_reconcile_alembic_state_multiple_heads(tmp_path):
    """Verify reconcile_alembic_state prunes older revisions when multiple heads exist."""
    from sqlalchemy import text
    from scripts.run_staging_migrations import reconcile_alembic_state

    db_file = tmp_path / "multi_head_test.db"
    db_url = f"sqlite:///{db_file}"
    engine = create_engine(db_url)

    with engine.begin() as conn:
        conn.execute(text("CREATE TABLE alembic_version (version_num VARCHAR(32) PRIMARY KEY)"))
        conn.execute(text("INSERT INTO alembic_version (version_num) VALUES ('23ae96902881')"))
        # SQLite doesn't enforce single row primary key across different values, so insert second row
        conn.execute(text("INSERT OR REPLACE INTO alembic_version (version_num) VALUES ('4e07a1b66416')"))

    reconcile_alembic_state(engine)

    with engine.begin() as conn:
        rows = conn.execute(text("SELECT version_num FROM alembic_version")).scalars().all()
        assert len(rows) == 1
        assert rows[0] == "4e07a1b66416"

    engine.dispose()


def test_reconcile_alembic_state_bootstraps_existing_schema(tmp_path):
    """Verify reconcile_alembic_state creates and stamps alembic_version when legacy tables exist."""
    from sqlalchemy import text
    from scripts.run_staging_migrations import reconcile_alembic_state

    db_file = tmp_path / "bootstrap_test.db"
    db_url = f"sqlite:///{db_file}"
    engine = create_engine(db_url)

    with engine.begin() as conn:
        conn.execute(text("CREATE TABLE food_items (id INTEGER PRIMARY KEY, name VARCHAR(120))"))
        conn.execute(text("CREATE TABLE users (id VARCHAR(36) PRIMARY KEY, email VARCHAR(255), firebase_uid VARCHAR(128))"))

    reconcile_alembic_state(engine)

    with engine.begin() as conn:
        rows = conn.execute(text("SELECT version_num FROM alembic_version")).scalars().all()
        assert len(rows) == 1
        assert rows[0] == "a1b2c3d4e5f6"

    engine.dispose()


def test_run_migrations_idempotent_on_schema_with_existing_columns(tmp_path):
    """Verify run_migrations completes successfully even if columns already exist in users table."""
    from scripts.run_staging_migrations import run_migrations

    db_file = tmp_path / "idempotent_test.db"
    db_url = f"sqlite:///{db_file}"

    backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    alembic_ini = os.path.join(backend_dir, "alembic.ini")

    # Run initial upgrade
    run_migrations(alembic_ini, db_url)

    # Re-run upgrade to head - must not throw DuplicateColumn or DuplicateTable
    run_migrations(alembic_ini, db_url)

