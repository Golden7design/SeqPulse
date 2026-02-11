from fastapi import FastAPI, Depends, Request
import logging
from datetime import datetime, timedelta, timezone
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from sqlalchemy import text
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded

from app.db.deps import get_db
from app.auth.routes import router as auth_router
from app.projects.routes import router as projects_router
from app.deployments.routes import router as deployments_router
from app.sdh.routes import router as sdh_router
from app.db.models import User, Project, Subscription, Deployment, MetricSample, deployment_verdict, SDHHint, ScheduledJob
from app.scheduler.poller import poller, RUNNING_STUCK_SECONDS
from app.core.rate_limit import limiter

# Cleanup des archives métriques plutard

LOG_FORMAT = "%(asctime)s %(levelname)s %(name)s %(message)s"
logging.basicConfig(level=logging.INFO, format=LOG_FORMAT, force=True)

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

@app.get("/health")
def health():
    return {"message": "en bonne santé"}


@app.get("/health/scheduler")
def scheduler_health(db: Session = Depends(get_db)):
    now = datetime.now(timezone.utc)
    cutoff = now - timedelta(seconds=RUNNING_STUCK_SECONDS)

    pending = db.query(ScheduledJob).filter(ScheduledJob.status == "pending").count()
    running = db.query(ScheduledJob).filter(ScheduledJob.status == "running").count()
    failed = db.query(ScheduledJob).filter(ScheduledJob.status == "failed").count()
    stuck_running = db.query(ScheduledJob).filter(
        ScheduledJob.status == "running",
        ScheduledJob.updated_at.isnot(None),
        ScheduledJob.updated_at < cutoff,
    ).count()

    return {
        "poller_running": bool(poller.running),
        "pending": pending,
        "running": running,
        "failed": failed,
        "stuck_running": stuck_running,
    }
