# app/deployments/routes.py
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, Request, Header, Response, HTTPException, Query
from sqlalchemy.orm import Session, joinedload
from typing import Optional, List

from app.auth.deps import get_current_user
from app.core.public_ids import (
    format_deployment_public_id,
    parse_deployment_identifier,
    parse_project_identifier,
)
from app.db.models.user import User
from app.db.session import get_db
from app.db.models.project import Project
from app.db.models.deployment import Deployment
from app.db.models.metric_sample import MetricSample
from app.deployments.schemas import (
    DeploymentTriggerRequest,
    DeploymentTriggerResponse,
    DeploymentFinishRequest,
    DeploymentFinishResponse,
    DeploymentDashboardOut,
    DeploymentVerdictOut,
    MetricSampleOut,
)
from app.deployments.deps import get_project_by_api_key
from app.deployments.services import (
    trigger_deployment_flow,
    finish_deployment_flow,
)
from app.core.rate_limit import limiter, RATE_LIMITS

router = APIRouter(prefix="/deployments", tags=["deployments"])


@router.get("/", response_model=List[DeploymentDashboardOut])
def list_deployments(
    project_id: Optional[str] = Query(None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    query = (
        db.query(Deployment)
        .join(Project, Deployment.project_id == Project.id)
        .options(joinedload(Deployment.project), joinedload(Deployment.verdict))
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
            query = query.filter(Deployment.project_id == identifier_value)

    deployments = query.order_by(Deployment.started_at.desc()).all()
    return [_to_dashboard_deployment(deployment) for deployment in deployments]


@router.get("/{deployment_id}", response_model=DeploymentDashboardOut)
def get_deployment(
    deployment_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    deployment = _find_deployment_for_user(
        db=db,
        current_user=current_user,
        deployment_id=deployment_id,
    )
    if not deployment:
        raise HTTPException(status_code=404, detail="Deployment not found")
    return _to_dashboard_deployment(deployment)


@router.get("/{deployment_id}/metrics", response_model=List[MetricSampleOut])
def get_deployment_metrics(
    deployment_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    deployment = _find_deployment_for_user(
        db=db,
        current_user=current_user,
        deployment_id=deployment_id,
    )
    if not deployment:
        raise HTTPException(status_code=404, detail="Deployment not found")

    samples = (
        db.query(MetricSample)
        .filter(MetricSample.deployment_id == deployment.id)
        .order_by(MetricSample.collected_at.asc())
        .all()
    )
    return [
        MetricSampleOut(
            id=str(sample.id),
            deployment_id=format_deployment_public_id(int(deployment.deployment_number))
            if deployment.deployment_number
            else "",
            phase=sample.phase,
            requests_per_sec=sample.requests_per_sec,
            latency_p95=sample.latency_p95,
            error_rate=sample.error_rate,
            cpu_usage=sample.cpu_usage,
            memory_usage=sample.memory_usage,
            collected_at=sample.collected_at,
        )
        for sample in samples
    ]



# CI/CD ENDPOINTS (API Key)

@router.post("/trigger", response_model=DeploymentTriggerResponse)
@limiter.limit(RATE_LIMITS["deployments"])
def trigger_deployment(
    request: Request,
    response: Response,
    payload: DeploymentTriggerRequest,
    idempotency_key: Optional[str] = Header(None, alias="X-Idempotency-Key"),
    project: Project = Depends(get_project_by_api_key),
    db: Session = Depends(get_db),
):
    return trigger_deployment_flow(
        db=db,
        project=project,
        payload=payload,
        idempotency_key=idempotency_key,
    )


@router.post("/finish", response_model=DeploymentFinishResponse)
@limiter.limit(RATE_LIMITS["deployments"])
def finish_deployment(
    request: Request,
    response: Response,
    payload: DeploymentFinishRequest,
    project: Project = Depends(get_project_by_api_key),
    db: Session = Depends(get_db),
):
    return finish_deployment_flow(
        db=db,
        project=project,
        payload=payload,
    )


def _to_dashboard_deployment(deployment: Deployment) -> DeploymentDashboardOut:
    verdict_value = _dashboard_verdict(deployment)
    summary = (
        deployment.verdict.summary
        if deployment.verdict and deployment.verdict.summary
        else _default_summary(verdict_value)
    )
    details = (
        deployment.verdict.details
        if deployment.verdict and deployment.verdict.details
        else []
    )
    confidence = (
        deployment.verdict.confidence
        if deployment.verdict
        else 0.5
    )
    started_at = deployment.started_at or datetime.now(timezone.utc)
    finished_at = deployment.finished_at or started_at

    deployment_number = int(deployment.deployment_number or 0)
    public_id = format_deployment_public_id(deployment_number) if deployment_number > 0 else ""
    normalized_pipeline_result = _normalized_pipeline_result(deployment.pipeline_result)
    normalized_state = _normalized_state(deployment.state)
    return DeploymentDashboardOut(
        id=public_id,
        internal_id=str(deployment.id),
        public_id=public_id,
        deployment_number=deployment_number,
        project=deployment.project.name if deployment.project else "",
        env=deployment.env,
        pipeline_result=normalized_pipeline_result,
        verdict=DeploymentVerdictOut(
            verdict=verdict_value,
            confidence=confidence,
            summary=summary,
            details=details,
        ),
        state=normalized_state,
        started_at=started_at,
        finished_at=finished_at,
        duration_ms=deployment.duration_ms or 0,
    )


def _dashboard_verdict(deployment: Deployment) -> str:
    raw_verdict = deployment.verdict.verdict if deployment.verdict else None
    if raw_verdict in {"ok", "warning", "rollback_recommended"}:
        return raw_verdict
    if raw_verdict == "attention":
        return "warning"
    if deployment.pipeline_result == "failed":
        return "rollback_recommended"
    return "ok"


def _default_summary(verdict: str) -> str:
    if verdict == "rollback_recommended":
        return "Critical regressions detected"
    if verdict == "warning":
        return "Potential performance degradation detected"
    return "No significant regression detected"


def _normalized_pipeline_result(raw_pipeline_result: str | None) -> str | None:
    if raw_pipeline_result is None:
        return None

    value = raw_pipeline_result.strip().lower()
    if value in {"success", "failed"}:
        return value

    legacy_map = {
        "succeeded": "success",
        "ok": "success",
        "pass": "success",
        "failure": "failed",
        "error": "failed",
        "ko": "failed",
    }
    return legacy_map.get(value)


def _normalized_state(raw_state: str | None) -> str:
    if raw_state is None:
        return "pending"

    value = raw_state.strip().lower()
    if value in {"pending", "running", "finished", "analyzed"}:
        return value

    legacy_map = {
        "queued": "pending",
        "processing": "running",
        "done": "finished",
    }
    return legacy_map.get(value, "pending")


def _find_deployment_for_user(db: Session, current_user: User, deployment_id: str) -> Deployment | None:
    try:
        identifier_type, identifier_value = parse_deployment_identifier(deployment_id)
    except ValueError:
        return None

    query = (
        db.query(Deployment)
        .join(Project, Deployment.project_id == Project.id)
        .options(joinedload(Deployment.project), joinedload(Deployment.verdict))
        .filter(Project.owner_id == current_user.id)
    )

    if identifier_type == "number":
        matches = query.filter(Deployment.deployment_number == identifier_value).limit(2).all()
        if len(matches) > 1:
            raise HTTPException(
                status_code=400,
                detail="Ambiguous deployment_id. Use deployment UUID instead of dpl_<number>.",
            )
        return matches[0] if matches else None

    return query.filter(Deployment.id == identifier_value).first()
