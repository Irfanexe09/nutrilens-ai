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
            logger.warning(f"Connection attempt {attempt}/{max_retries} failed: {e}")
            if attempt < max_retries:
                time.sleep(delay_seconds)
    return False


def run_migrations(alembic_ini_path: str):
    """Run Alembic upgrade head programmatically."""
    logger.info(f"Executing Alembic migrations using config: {alembic_ini_path}...")
    alembic_cfg = Config(alembic_ini_path)
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

    engine = create_engine(settings.DATABASE_URL)

    if not wait_for_database(engine):
        logger.error("Database connection could not be established within retry limit. Aborting.")
        sys.exit(1)

    try:
        run_migrations(alembic_ini)
        seed_nutrition_database(engine)
        logger.info("Staging database initialization and migrations complete.")
    except Exception as e:
        logger.error(f"Migration routine failed: {e}", exc_info=True)
        sys.exit(1)


if __name__ == "__main__":
    main()
