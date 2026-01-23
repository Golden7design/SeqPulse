# app/deployments/deps.py
from fastapi import Header, HTTPException, Depends
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.db.models.project import Project


def get_project_by_api_key(
    x_api_key: str = Header(..., alias="X-API-Key"),
    db: Session = Depends(get_db),
) -> Project:
    project = (
        db.query(Project)
        .filter(Project.api_key == x_api_key)
        .first()
    )

    if not project:
        raise HTTPException(
            status_code=401,
            detail="Invalid API key",
        )

    return project
