from fastapi import Header, HTTPException, Depends
from sqlalchemy.orm import Session
from app.db.deps import get_db
from app.db.models.project import Project

def get_project_by_api_key(api_key: str = Header(...), db: Session = Depends(get_db)) -> Project:
    project = db.query(Project).filter(Project.api_key == api_key).first()
    if not project:
        raise HTTPException(status_code=401, detail="API key invalide")
    return project
