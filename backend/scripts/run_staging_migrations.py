import os
import sys
import time
import logging
from sqlalchemy import create_engine, text
from alembic.config import Config
from alembic import command

# Add parent directory to sys.path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.core.config import settings

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("staging.migrations")


def _sanitize_db_error(error_msg: str, engine) -> str:
    """Mask plain text password from error messages to prevent secret leaks in logs."""
    if engine.url.password and engine.url.password in error_msg:
        return error_msg.replace(engine.url.password, "******")
    return error_msg


def wait_for_database(engine, max_retries: int = 15, delay_seconds: float = 2.0) -> bool:
    """Check database availability with retry backoff."""
    logger.info(f"Connecting to database: {engine.url.render_as_string(hide_password=True)}...")
    for attempt in range(1, max_retries + 1):
        try:
            with engine.connect() as conn:
                conn.execute(text("SELECT 1"))
            logger.info("Database connection established successfully.")
            return True
        except Exception as e:
            sanitized = _sanitize_db_error(str(e), engine)
            logger.warning(f"Connection attempt {attempt}/{max_retries} failed: {sanitized}")
            if attempt < max_retries:
                time.sleep(delay_seconds)
    return False


import traceback
from sqlalchemy import inspect

MIGRATION_ORDER = [
    "23ae96902881",
    "4e07a1b66416",
    "a1b2c3d4e5f6",
    "b2c3d4e5f6a7",
    "c3d4e5f6a7b8",
]


def reconcile_alembic_state(engine) -> None:
    """
    Ensure alembic_version table is in a valid, single-head state.
    1. If multiple revisions exist in alembic_version, prune older ancestor rows
       to eliminate 'Requested revision overlaps with other requested revisions' errors.
    2. If alembic_version table is missing on a database with pre-existing tables,
       seed alembic_version at the correct schema revision to prevent 'relation already exists'.
    """
    insp = inspect(engine)
    table_names = set(insp.get_table_names())

    with engine.begin() as conn:
        if "alembic_version" in table_names:
            rows = conn.execute(text("SELECT version_num FROM alembic_version")).scalars().all()
            if len(rows) > 1:
                logger.warning(f"Detected multiple revisions in alembic_version: {rows}. Resolving to latest linear head...")
                known = [r for r in rows if r in MIGRATION_ORDER]
                if known:
                    latest = max(known, key=lambda r: MIGRATION_ORDER.index(r))
                    conn.execute(text("DELETE FROM alembic_version WHERE version_num != :latest"), {"latest": latest})
                    logger.info(f"Reconciled alembic_version to single active head: '{latest}'.")
        else:
            # alembic_version does not exist. Check if tables already exist.
            if "food_items" in table_names:
                logger.warning("Existing application tables detected without alembic_version table. Bootstrapping Alembic version state...")
                conn.execute(text("CREATE TABLE alembic_version (version_num VARCHAR(32) PRIMARY KEY)"))

                if "weight_entries" in table_names:
                    stamp = "c3d4e5f6a7b8"
                elif "users" in table_names:
                    user_cols = {c["name"] for c in insp.get_columns("users")}
                    if "password_reset_token_hash" in user_cols:
                        stamp = "b2c3d4e5f6a7"
                    elif "firebase_uid" in user_cols:
                        stamp = "a1b2c3d4e5f6"
                    else:
                        stamp = "4e07a1b66416"
                else:
                    stamp = "23ae96902881"

                conn.execute(text("INSERT INTO alembic_version (version_num) VALUES (:stamp)"), {"stamp": stamp})
                logger.info(f"Bootstrapped alembic_version at revision '{stamp}'.")


def run_migrations(alembic_ini_path: str, db_url: str):
    """Run Alembic upgrade head programmatically."""
    logger.info(f"Executing Alembic migrations using config: {alembic_ini_path}...")
    alembic_cfg = Config(alembic_ini_path)
    # Escape % characters to %% to avoid ConfigParser interpolation syntax errors
    alembic_cfg.set_main_option("sqlalchemy.url", db_url.replace("%", "%%"))
    command.upgrade(alembic_cfg, "head")
    logger.info("Alembic schema migrations applied successfully.")


def seed_nutrition_database(engine):
    """Ensure core nutrition dataset is seeded idempotently."""
    from sqlalchemy.orm import sessionmaker
    from app.services.food_service import FoodService

    Session = sessionmaker(bind=engine)
    session = Session()
    try:
        service = FoodService(session)
        seeded = service.seed_database()
        if seeded > 0:
            logger.info(f"Seeded {seeded} Indian food items into the nutrition database.")
        else:
            logger.info("Nutrition database is already populated.")
    finally:
        session.close()


def main():
    logger.setLevel(logging.INFO)
    logger.info(f"Starting staging migration routine for environment: '{settings.ENVIRONMENT}'")
    backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    alembic_ini = os.path.join(backend_dir, "alembic.ini")

    connect_args = {}
    if settings.DATABASE_URL.startswith("sqlite"):
        connect_args["check_same_thread"] = False

    engine = create_engine(settings.DATABASE_URL, pool_pre_ping=True, connect_args=connect_args)

    if not wait_for_database(engine):
        msg = "Database connection could not be established within retry limit. Aborting."
        logger.error(msg)
        sys.stderr.write(f"\n[FATAL] {msg}\n")
        sys.exit(1)

    try:
        reconcile_alembic_state(engine)
        run_migrations(alembic_ini, settings.DATABASE_URL)
        seed_nutrition_database(engine)
        logger.info("Staging database initialization and migrations complete.")
    except Exception as e:
        sanitized_msg = _sanitize_db_error(str(e), engine)
        sanitized_trace = _sanitize_db_error(traceback.format_exc(), engine)
        logger.error(f"Migration routine failed: {sanitized_msg}")
        # Always emit sanitized failure trace directly to stderr to prevent log suppression
        sys.stderr.write(f"\n[FATAL] Alembic migration routine failed:\n{sanitized_trace}\n")
        sys.stderr.flush()
        sys.exit(1)


if __name__ == "__main__":
    main()
