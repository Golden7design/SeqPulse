# app/projects/routes.py
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from uuid import UUID

from app.db.deps import get_db
from app.auth.deps import get_current_user
from app.db.models.user import User
from app.db.models.project import Project
from app.db.models.deployment import Deployment
from app.projects.schemas import ProjectCreate, ProjectOut
from app.projects.utils import generate_api_key
from app.deployments.schemas import DeploymentOut  # ← IMPORT AJOUTÉ

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
        owner_id=current_user.id,
        envs=project_in.envs,
        api_key=generate_api_key(),
    )
    db.add(project)
    db.commit()
    db.refresh(project)
    return project  # Pydantic gère la conversion via orm_mode

@router.get("/{project_id}/deployments", response_model=List[DeploymentOut])
def list_project_deployments(
    project_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    project = db.query(Project).filter(
        Project.id == project_id,
        Project.owner_id == current_user.id
    ).first()
    
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    deployments = db.query(Deployment).filter(
        Deployment.project_id == project.id
    ).order_by(Deployment.started_at.desc()).all()
    
    return deployments