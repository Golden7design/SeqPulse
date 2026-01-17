# app/projects/routes.py
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.db.deps import get_db
from app.auth.deps import get_current_user
from app.db.models.user import User
from app.db.models.project import Project
from app.projects.schemas import ProjectCreate, ProjectOut
from app.projects.utils import generate_api_key

router = APIRouter(prefix="/projects", tags=["projects"])

@router.post("/", response_model=ProjectOut)
def create_project(
    project_in: ProjectCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    # Créer le projet
    project = Project(
        name=project_in.name,
        description=project_in.description,
        owner_id=current_user.id,
        envs=project_in.envs,
        api_key=generate_api_key(),  # SP_ + uuid
    )
    db.add(project)
    db.commit()
    db.refresh(project)

    return ProjectOut(
        id=str(project.id),
        name=project.name,
        description=project.description,
        api_key=project.api_key,
        envs=project.envs,
        owner_id=str(project.owner_id)
    )
