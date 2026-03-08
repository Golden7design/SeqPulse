# app/deployments/schemas.py
from datetime import datetime
from pydantic import BaseModel, UUID4, Field, HttpUrl
from typing import Optional, Literal, List, Any, Dict

class DeploymentTriggerRequest(BaseModel):
    env: str
    idempotency_key: Optional[str] = Field(
        None,
        description="Opaque idempotency key (ex: CI/CD run id)",
        max_length=255,
    )
    branch: Optional[str] = Field(None, description="Git branch name", max_length=255)
    metrics_endpoint: Optional[HttpUrl] = Field(
        None,
        description="Compat field: must match project active endpoint when provided",
    )


class DeploymentTriggerResponse(BaseModel):
    deployment_id: UUID4
    status: Literal["created", "existing"]
    message: Optional[str] = None


class DeploymentFinishRequest(BaseModel):
    deployment_id: UUID4 = Field(..., description="ID du déploiement")
    result: Literal["success", "failed"] = Field(..., description="Résultat du pipeline CI/CD")
    metrics_endpoint: Optional[HttpUrl] = Field(
        None,
        description="URL pour collecter les métriques POST",
        examples=["https://api.prod.com/ds-metrics"]
    )

class DeploymentFinishResponse(BaseModel):
    status: Literal["accepted", "ignored", "not_found"]
    message: Optional[str] = None


class LocalizedTextOut(BaseModel):
    key: Optional[str] = None
    params: Dict[str, Any] = Field(default_factory=dict)
    fallback: str


class DeploymentVerdictOut(BaseModel):
    verdict: Literal["ok", "warning", "rollback_recommended"]
    confidence: float
    summary: str
    details: List[str]
    summary_i18n: Optional[LocalizedTextOut] = None
    details_i18n: List[LocalizedTextOut] = Field(default_factory=list)


class DeploymentDashboardOut(BaseModel):
    id: str
    internal_id: str
    public_id: str
    deployment_number: int
    project: str
    env: str
    pipeline_result: Optional[Literal["success", "failed"]] = None
    verdict: DeploymentVerdictOut
    state: Literal["pending", "running", "finished", "analyzed"]
    started_at: datetime
    finished_at: datetime
    duration_ms: int


class MetricSampleOut(BaseModel):
    id: str
    deployment_id: str
    phase: Literal["pre", "post"]
    requests_per_sec: float
    latency_p95: float
    error_rate: float
    cpu_usage: float
    memory_usage: float
    collected_at: datetime


class DeploymentHMACCleanupResponse(BaseModel):
    deployment_id: str
    dry_run: bool
    has_hmac_failure: bool
    cleaned_jobs: int
