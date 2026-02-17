from collections import defaultdict
from typing import Dict, List, Optional, Literal, Tuple
from uuid import UUID

from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.orm import Session

from app.analysis.constants import ABSOLUTE_THRESHOLDS
from app.auth.deps import get_current_user
from app.core.public_ids import (
    format_deployment_public_id,
    parse_deployment_identifier,
    parse_project_identifier,
)
from app.db.deps import get_db
from app.db.models.project import Project
from app.db.models.deployment import Deployment
from app.db.models.metric_sample import MetricSample
from app.db.models.sdh_hint import SDHHint
from app.db.models.user import User
from app.sdh.schemas import SDHOut, SDHSignalOut


router = APIRouter(prefix="/sdh", tags=["sdh"])
SUPPORTED_METRICS = ("requests_per_sec", "latency_p95", "error_rate", "cpu_usage", "memory_usage")
COMPOSITE_SIGNAL_BY_TITLE: Dict[str, Tuple[str, ...]] = {
    "Service degradation detected": ("error_rate", "latency_p95"),
    "Compute saturation suspected": ("latency_p95", "cpu_usage"),
    "Partial outage suspected": ("error_rate", "requests_per_sec"),
}


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
    phase_aggregates_by_deployment = _aggregate_metrics_by_phase(
        db=db,
        deployment_ids=[deployment.id for _, deployment, _ in rows],
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
            composite_signals=_build_composite_signals(
                hint=hint,
                phase_aggregates=phase_aggregates_by_deployment.get(deployment.id),
            ),
            created_at=hint.created_at,
        )
        for hint, deployment, project in rows
    ]


def _aggregate_metrics_by_phase(
    db: Session,
    deployment_ids: List[UUID],
) -> Dict[UUID, Dict[str, Dict[str, float]]]:
    if not deployment_ids:
        return {}

    samples = (
        db.query(MetricSample)
        .filter(
            MetricSample.deployment_id.in_(deployment_ids),
            MetricSample.phase.in_(["pre", "post"]),
        )
        .all()
    )

    accumulator: Dict[UUID, Dict[str, Dict[str, List[float]]]] = {}
    for sample in samples:
        by_phase = accumulator.setdefault(
            sample.deployment_id,
            {"pre": defaultdict(list), "post": defaultdict(list)},
        )
        phase_key = "post" if sample.phase == "post" else "pre"
        for metric in SUPPORTED_METRICS:
            by_phase[phase_key][metric].append(float(getattr(sample, metric)))

    aggregated: Dict[UUID, Dict[str, Dict[str, float]]] = {}
    for deployment_id, phase_map in accumulator.items():
        aggregated[deployment_id] = {}
        for phase, metric_map in phase_map.items():
            aggregated[deployment_id][phase] = {
                metric: (sum(values) / len(values))
                for metric, values in metric_map.items()
                if values
            }

    return aggregated


def _build_composite_signals(
    hint: SDHHint,
    phase_aggregates: Optional[Dict[str, Dict[str, float]]],
) -> List[SDHSignalOut]:
    if hint.metric != "composite":
        return []

    signal_metrics = COMPOSITE_SIGNAL_BY_TITLE.get(hint.title, ())
    if not signal_metrics:
        return []

    post_values = phase_aggregates.get("post", {}) if phase_aggregates else {}
    pre_values = phase_aggregates.get("pre", {}) if phase_aggregates else {}

    signals: List[SDHSignalOut] = []
    for metric in signal_metrics:
        threshold = (
            pre_values.get("requests_per_sec")
            if metric == "requests_per_sec"
            else ABSOLUTE_THRESHOLDS.get(metric)
        )
        signals.append(
            SDHSignalOut(
                metric=metric,
                observed_value=post_values.get(metric),
                threshold=threshold,
            )
        )

    return signals
