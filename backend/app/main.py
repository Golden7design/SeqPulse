from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from sqlalchemy import text

from app.db.deps import get_db
from app.auth.routes import router as auth_router
from app.projects.routes import router as projects_router
from app.deployments.routes import router as deployments_router

app = FastAPI()

# CORS CONFIGURATION

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
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

# HEALTH & DEBUG

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
