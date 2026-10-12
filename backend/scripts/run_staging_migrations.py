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


def run_migrations(alembic_ini_path: str, db_url: str):
    """Run Alembic upgrade head programmatically."""
    logger.info(f"Executing Alembic migrations using config: {alembic_ini_path}...")
    alembic_cfg = Config(alembic_ini_path)
    alembic_cfg.set_main_option("sqlalchemy.url", db_url)
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
    logger.info(f"Starting staging migration routine for environment: '{settings.ENVIRONMENT}'")
    backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    alembic_ini = os.path.join(backend_dir, "alembic.ini")

    connect_args = {}
    if settings.DATABASE_URL.startswith("sqlite"):
        connect_args["check_same_thread"] = False

    engine = create_engine(settings.DATABASE_URL, pool_pre_ping=True, connect_args=connect_args)

    if not wait_for_database(engine):
        logger.error("Database connection could not be established within retry limit. Aborting.")
        sys.exit(1)

    try:
        run_migrations(alembic_ini, settings.DATABASE_URL)
        seed_nutrition_database(engine)
        logger.info("Staging database initialization and migrations complete.")
    except Exception as e:
        sanitized = _sanitize_db_error(str(e), engine)
        logger.error(f"Migration routine failed: {sanitized}")
        sys.exit(1)


if __name__ == "__main__":
    main()
