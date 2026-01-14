from fastapi import FastAPI, Depends
from sqlalchemy.orm import Session
from sqlalchemy import text

from app.db.deps import get_db
from app.auth.routes import router as auth_router

app = FastAPI()

app.include_router(auth_router, prefix="/auth", tags=["auth"])

@app.get("/db-check")
def db_check(db: Session = Depends(get_db)):
    result = db.execute(text("SELECT 1")).scalar()
    return {"db_ok": result == 1}


@app.get("/")
def root():
    return {"message": "CC"
    }

@app.get("/health")
def health():
    return {"message": "en bonne santé"
    }
