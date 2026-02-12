import time
from fastapi import FastAPI, Depends, Request, Response
from datetime import datetime, timedelta, timezone
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from sqlalchemy import text
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded

from app.db.deps import get_db
from app.core.logging_config import configure_logging
from app.auth.routes import router as auth_router
from app.projects.routes import router as projects_router
from app.deployments.routes import router as deployments_router
from app.sdh.routes import router as sdh_router
from app.db.models import User, Project, Subscription, Deployment, MetricSample, deployment_verdict, SDHHint, ScheduledJob
from app.scheduler.poller import POLL_INTERVAL, RUNNING_STUCK_SECONDS, poller
from app.core.rate_limit import limiter
from app.observability.metrics import observe_http_request, render_metrics

# Cleanup des archives métriques plutard
HEARTBEAT_STALE_SECONDS = max(POLL_INTERVAL * 3, 30)

configure_logging()

app = FastAPI()

# RATE LIMITING
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# CORS CONFIGURATION

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3001",
        "http://127.0.0.1:3000",
        "http://localhost:8080",
        # "https://dashboard.seqpulse.dev"  # plus tard
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.middleware("http")
async def http_metrics_middleware(request: Request, call_next):
    started_at = time.perf_counter()

    try:
        response = await call_next(request)
    except Exception:
        path = _request_path_template(request)
        if path != "/metrics":
            observe_http_request(
                method=request.method,
                path=path,
                status_code=500,
                duration_seconds=time.perf_counter() - started_at,
            )
        raise

    path = _request_path_template(request)
    if path != "/metrics":
        observe_http_request(
            method=request.method,
            path=path,
            status_code=response.status_code,
            duration_seconds=time.perf_counter() - started_at,
        )
    return response


# ROUTERS

app.include_router(auth_router, prefix="/auth", tags=["auth"])

app.include_router(projects_router)

app.include_router(deployments_router)

app.include_router(sdh_router)

# HEALTH & DEBUG

@app.on_event("startup")
async def startup_event():
    await poller.start()

@app.on_event("shutdown")
async def shutdown_event():
    await poller.stop()

@app.get("/db-check")
def db_check(db: Session = Depends(get_db)):
    result = db.execute(text("SELECT 1")).scalar()
    return {"db_ok": result == 1}

@app.get("/")
def root():
    return {"message": "CC"}

@app.get("/metrics", include_in_schema=False)
def metrics():
    payload, content_type = render_metrics()
    return Response(content=payload, media_type=content_type)

@app.get("/health")
def health(db: Session = Depends(get_db)):
    now = datetime.now(timezone.utc)
    db_ok = _db_ok(db)
    scheduler = _scheduler_snapshot(db=db, now=now)

    scheduler_db_ok = scheduler["db_query_ok"]
    stuck_running_ok = scheduler_db_ok and scheduler["stuck_running"] == 0
    failed_jobs_ok = scheduler_db_ok and scheduler["failed"] == 0

    checks = {
        "db": db_ok,
        "poller_running": scheduler["poller_running"],
        "scheduler_heartbeat_fresh": scheduler["heartbeat_fresh"],
        "scheduler_db_query": scheduler_db_ok,
        "stuck_running_jobs": stuck_running_ok,
        "failed_jobs": failed_jobs_ok,
    }
    status = "ok" if all(checks.values()) else "degraded"
    reasons = [name for name, ok in checks.items() if not ok]

    return {
        "status": status,
        "timestamp": now.isoformat(),
        "checks": checks,
        "reasons": reasons,
        "scheduler": scheduler,
    }


@app.get("/health/scheduler")
def scheduler_health(db: Session = Depends(get_db)):
    now = datetime.now(timezone.utc)
    scheduler = _scheduler_snapshot(db=db, now=now)
    scheduler_db_ok = scheduler["db_query_ok"]
    stuck_running_ok = scheduler_db_ok and scheduler["stuck_running"] == 0
    failed_jobs_ok = scheduler_db_ok and scheduler["failed"] == 0

    checks = {
        "poller_running": scheduler["poller_running"],
        "heartbeat_fresh": scheduler["heartbeat_fresh"],
        "scheduler_db_query": scheduler_db_ok,
        "stuck_running_jobs": stuck_running_ok,
        "failed_jobs": failed_jobs_ok,
    }
    status = "ok" if all(checks.values()) else "degraded"

    return {
        "status": status,
        "timestamp": now.isoformat(),
        "checks": checks,
        **scheduler,
    }


def _db_ok(db: Session) -> bool:
    try:
        return db.execute(text("SELECT 1")).scalar() == 1
    except Exception:
        return False


def _scheduler_snapshot(db: Session, now: datetime) -> dict:
    cutoff = now - timedelta(seconds=RUNNING_STUCK_SECONDS)
    heartbeat_at = poller.last_heartbeat_at
    heartbeat_age_seconds = None
    heartbeat_fresh = False

    if heartbeat_at is not None:
        heartbeat_age_seconds = max(0.0, (now - heartbeat_at).total_seconds())
        heartbeat_fresh = heartbeat_age_seconds <= HEARTBEAT_STALE_SECONDS

    db_query_ok = True
    try:
        pending = db.query(ScheduledJob).filter(ScheduledJob.status == "pending").count()
        running = db.query(ScheduledJob).filter(ScheduledJob.status == "running").count()
        failed = db.query(ScheduledJob).filter(ScheduledJob.status == "failed").count()
        stuck_running = db.query(ScheduledJob).filter(
            ScheduledJob.status == "running",
            ScheduledJob.updated_at.isnot(None),
            ScheduledJob.updated_at < cutoff,
        ).count()
    except Exception:
        db_query_ok = False
        pending = None
        running = None
        failed = None
        stuck_running = None

    return {
        "poller_running": bool(poller.running),
        "db_query_ok": db_query_ok,
        "heartbeat_at": heartbeat_at.isoformat() if heartbeat_at else None,
        "heartbeat_age_seconds": heartbeat_age_seconds,
        "heartbeat_stale_after_seconds": HEARTBEAT_STALE_SECONDS,
        "heartbeat_fresh": heartbeat_fresh,
        "pending": pending,
        "running": running,
        "failed": failed,
        "stuck_running": stuck_running,
    }


def _request_path_template(request: Request) -> str:
    route = request.scope.get("route")
    if route is not None and hasattr(route, "path"):
        return route.path
    return "__unmatched__"
