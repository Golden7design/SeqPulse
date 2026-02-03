# app/projects/routes.py
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from pydantic import UUID4

from app.db.deps import get_db
from app.auth.deps import get_current_user
from app.db.models.user import User
from app.db.models.project import Project
from app.db.models.deployment import Deployment
from app.projects.schemas import ProjectCreate, ProjectOut, ProjectHmacSecret
from app.projects.utils import generate_api_key, generate_hmac_secret

router = APIRouter(prefix="/projects", tags=["projects"])

@router.post("/", response_model=ProjectOut)
def create_project(
    project_in: ProjectCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    project = Project(
        name=project_in.name,
        description=project_in.description,
        tech_stack=project_in.tech_stack,
        owner_id=current_user.id,
        envs=project_in.envs,
        api_key=generate_api_key(),
        hmac_secret=generate_hmac_secret(),  # stocké, mais pas retourné
    )
    db.add(project)
    db.commit()
    db.refresh(project)
    return project  # Ne contient PAS hmac_secret


@router.post("/{project_id}/hmac/enable", response_model=ProjectHmacSecret)
def enable_hmac_and_reveal_secret(
    project_id: UUID4,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    project = db.query(Project).filter(
        Project.id == project_id,
        Project.owner_id == current_user.id
    ).first()

    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    if project.hmac_enabled:
        raise HTTPException(status_code=400, detail="HMAC already enabled")

    # Active HMAC
    project.hmac_enabled = True
    db.commit()

    # Révèle le secret UNE SEULE FOIS
    return ProjectHmacSecret(hmac_secret=project.hmac_secret)

@router.post("/{project_id}/hmac/disable", response_model=ProjectOut)
def disable_hmac(
    project_id: UUID4,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    project = db.query(Project).filter(
        Project.id == project_id,
        Project.owner_id == current_user.id
    ).first()

    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    project.hmac_enabled = False
    db.commit()
    db.refresh(project)
    return project
