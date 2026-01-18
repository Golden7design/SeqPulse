import threading
from uuid import UUID
from app.db.session import SessionLocal
from app.services.analysis import analyze_deployment

# Dictionnaire pour suivre les timers actifs (optionnel, pour debug)
_active_timers: dict[UUID, threading.Timer] = {}

def schedule_analysis(deployment_id: UUID, delay_minutes: int = 2):
    """
    Planifie l'analyse d'un déploiement après un délai.
    Utilise threading.Timer (DEV ONLY).
    """
    delay_seconds = delay_minutes * 60

    def _run_analysis():
        db = SessionLocal()
        try:
            analyze_deployment(deployment_id, db)
        finally:
            db.close()
        # Optionnel : nettoyer le timer du registre
        _active_timers.pop(deployment_id, None)

    # Annuler un timer existant (au cas où)
    if deployment_id in _active_timers:
        _active_timers[deployment_id].cancel()

    # Créer et démarrer le nouveau timer
    timer = threading.Timer(delay_seconds, _run_analysis)
    _active_timers[deployment_id] = timer
    timer.start()

    print(f"Analyse planifiée pour deployment {deployment_id} dans {delay_minutes} min")