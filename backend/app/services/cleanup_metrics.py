import os
import sys
from pathlib import Path
sys.path.append(str(Path(__file__).parent.parent))

from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker
from app.core.settings import settings

def main():
    engine = create_engine(settings.DATABASE_URL)
    with engine.connect() as conn:
        # FREE: 7 jours | PRO: 30 jours
        conn.execute(text("""
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
        print(" Nettoyage terminé")

if __name__ == "__main__":
    main()