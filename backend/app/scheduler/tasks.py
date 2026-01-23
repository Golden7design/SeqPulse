# app/scheduler/tasks.py
import threading
import time
from uuid import UUID

POST_COLLECTION_INTERVAL = 60  # seconds
OBSERVATION_WINDOW_MINUTES = 5  # Free plan

def schedule_post_collection(deployment_id: UUID, metrics_endpoint: str, project, observation_window: int = 5):
    def _run():
        from app.db.session import SessionLocal
        from app.metrics.collector import collect_metrics

        db = SessionLocal()
        try:
            for _ in range(observation_window):
                collect_metrics(
                    deployment_id=deployment_id,
                    phase="post",
                    metrics_endpoint=metrics_endpoint,
                    db=db,
                    use_hmac=project.hmac_enabled,
                    secret=project.hmac_secret,
                )
                time.sleep(POST_COLLECTION_INTERVAL)
        finally:
            db.close()

    thread = threading.Thread(target=_run, daemon=True)
    thread.start()

def schedule_analysis(deployment_id: UUID, delay_minutes: int):
    print(f"Analyse planifiée pour deployment {deployment_id} dans {delay_minutes} min")
    
    def _run():
        print(f"Démarrage de l'analyse pour deployment {deployment_id}")
        from app.db.session import SessionLocal
        from app.analysis.engine import analyze_deployment
        db = SessionLocal()
        try:
            result = analyze_deployment(deployment_id, db)
            print(f"Analyse terminée: {result}")
        except Exception as e:
            print(f"Erreur dans analyze_deployment: {e}")
            import traceback
            traceback.print_exc()
        finally:
            db.close()

    timer = threading.Timer(delay_minutes * 60, _run)
    timer.start()