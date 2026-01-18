from pydantic import BaseModel, Field, UUID4
from typing import Literal, Dict, List, Optional
from datetime import datetime

# === 1. Trigger ===
class DeploymentTriggerRequest(BaseModel):
    env: str = Field(
        ...,
        min_length=1,
        max_length=50,
        description="Environnement cible (ex: prod, staging)",
        examples=["prod"]
    )

class DeploymentTriggerResponse(BaseModel):
    deployment_id: UUID4
    status: Literal["running"] = "running"

# === 2. Finish ===
class DeploymentFinishRequest(BaseModel):
    deployment_id: UUID4
    result: Literal["success", "failed"] = Field(
        ...,
        description="Résultat du déploiement selon le pipeline"
    )

class DeploymentFinishResponse(BaseModel):
    deployment_id: UUID4
    status: Literal["success", "failed"]

# === 3. Metrics (batch) ===
class MetricsBatchRequest(BaseModel):
    deployment_id: UUID4
    window: Literal["pre", "post"] = Field(
        ...,
        description="Phase de collecte"
    )
    metrics: Dict[str, float] = Field(
        ...,
        description="Dictionnaire de métriques {nom: valeur}",
        examples=[{"latency_p95": 120.0, "error_rate": 0.01}]
    )

class MetricsBatchResponse(BaseModel):
    received: int = Field(..., description="Nombre de métriques enregistrées")

# === 4. Verdict (lecture) ===
class DeploymentVerdictResponse(BaseModel):
    deployment_id: UUID4
    verdict: Literal["ok", "attention", "rollback_recommended"]
    confidence: float = Field(..., ge=0.0, le=1.0)
    summary: str = Field(..., max_length=255)
    details: List[str]
    created_at: datetime

# === 5. Détail complet (avec métriques) ===
class MetricSampleOut(BaseModel):
    name: str
    value: float
    window: Literal["pre", "post"]
    timestamp: datetime

    class Config:
        orm_mode = True

class DeploymentDetailOut(BaseModel):
    id: UUID4
    project_id: UUID4
    env: str
    status: str
    started_at: datetime
    finished_at: Optional[datetime]
    duration_ms: Optional[int]
    metrics: List[MetricSampleOut]

    class Config:
        orm_mode = True

class DeploymentOut(BaseModel):
    id: UUID4
    project_id: UUID4
    env: str
    status: str
    started_at: datetime
    finished_at: Optional[datetime]
    duration_ms: Optional[int]

    class Config:
        orm_mode = True