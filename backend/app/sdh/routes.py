from typing import List, Optional, Literal

from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.orm import Session

from app.auth.deps import get_current_user
from app.core.public_ids import (
    format_deployment_public_id,
    parse_deployment_identifier,
    parse_project_identifier,
)
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
    project_id: Optional[str] = None,
    deployment_id: Optional[str] = None,
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
        try:
            identifier_type, identifier_value = parse_project_identifier(project_id)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid project_id format")
        if identifier_type == "number":
            query = query.filter(Project.project_number == identifier_value)
        else:
            query = query.filter(Project.id == identifier_value)
    if deployment_id:
        try:
            identifier_type, identifier_value = parse_deployment_identifier(deployment_id)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid deployment_id format")
        if identifier_type == "number":
            if not project_id:
                raise HTTPException(
                    status_code=400,
                    detail="deployment_id dpl_<number> requires project_id when deployment numbers are project-scoped",
                )
            query = query.filter(Deployment.deployment_number == identifier_value)
        else:
            query = query.filter(Deployment.id == identifier_value)
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
            deployment_id=format_deployment_public_id(int(deployment.deployment_number))
            if deployment.deployment_number
            else "",
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
