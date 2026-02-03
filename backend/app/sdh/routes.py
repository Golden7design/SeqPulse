from typing import List, Optional, Literal

from fastapi import APIRouter, Depends, Query
from pydantic import UUID4
from sqlalchemy.orm import Session

from app.auth.deps import get_current_user
from app.db.deps import get_db
from app.db.models.project import Project
from app.db.models.deployment import Deployment
from app.db.models.sdh_hint import SDHHint
from app.db.models.user import User
from app.sdh.schemas import SDHOut


router = APIRouter(prefix="/sdh", tags=["sdh"])


@router.get("/", response_model=List[SDHOut])
def list_sdh(
    limit: int = Query(50, ge=1, le=200),
    project_id: Optional[UUID4] = None,
    deployment_id: Optional[UUID4] = None,
    severity: Optional[Literal["critical", "warning", "info"]] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    query = (
        db.query(SDHHint, Deployment, Project)
        .join(Deployment, SDHHint.deployment_id == Deployment.id)
        .join(Project, Deployment.project_id == Project.id)
        .filter(Project.owner_id == current_user.id)
    )

    if project_id:
        query = query.filter(Project.id == project_id)
    if deployment_id:
        query = query.filter(Deployment.id == deployment_id)
    if severity:
        query = query.filter(SDHHint.severity == severity)

    rows = (
        query.order_by(SDHHint.created_at.desc())
        .limit(limit)
        .all()
    )

    return [
        SDHOut(
            id=str(hint.id),
            deployment_id=str(deployment.id),
            project=project.name,
            env=deployment.env,
            severity=hint.severity,
            metric=hint.metric,
            observed_value=hint.observed_value,
            threshold=hint.threshold,
            confidence=hint.confidence,
            title=hint.title,
            diagnosis=hint.diagnosis,
            suggested_actions=hint.suggested_actions or [],
            created_at=hint.created_at,
        )
        for hint, deployment, project in rows
    ]
