import sys
from pathlib import Path

import structlog

sys.path.append(str(Path(__file__).parent.parent))

from sqlalchemy import create_engine, text
from app.core.settings import settings
from app.core.logging_config import configure_logging

logger = structlog.get_logger(__name__)

def main():
    configure_logging()
    engine = create_engine(settings.DATABASE_URL)
    with engine.connect() as conn:
        # FREE: 7 jours | PRO: 30 jours
        result = conn.execute(text("""
            DELETE FROM metric_samples
            WHERE id IN (
                SELECT ms.id
                FROM metric_samples ms
                JOIN deployments d ON ms.deployment_id = d.id
                JOIN projects p ON d.project_id = p.id
                WHERE (p.plan = 'free' AND ms.timestamp < NOW() - INTERVAL '7 days')
                   OR (p.plan = 'pro' AND ms.timestamp < NOW() - INTERVAL '30 days')
            )
        """))
        logger.info("metrics_cleanup_completed", deleted_rows=result.rowcount)

if __name__ == "__main__":
    main()
