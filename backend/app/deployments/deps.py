from fastapi import Header, HTTPException, Depends
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.db.models.project import Project

def get_project_by_api_key(
    x_api_key: str = Header(alias="X-API-Key"),
    db: Session = Depends(get_db)
) -> Project:
    """Valide l'API key et retourne le projet."""
    if not x_api_key:
        raise HTTPException(status_code=401, detail="Missing X-API-Key header")
    
    project = db.query(Project).filter(Project.api_key == x_api_key).first()
    if not project:
        raise HTTPException(status_code=401, detail="Invalid API key")
    
    return project