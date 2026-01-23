# app/deployments/schemas.py
from pydantic import BaseModel, UUID4, Field, HttpUrl
from typing import Optional, Literal

class DeploymentTriggerRequest(BaseModel):
    env: str
    metrics_endpoint: HttpUrl


class DeploymentTriggerResponse(BaseModel):
    deployment_id: UUID4
    status: Literal["running"]


class DeploymentFinishRequest(BaseModel):
    deployment_id: UUID4 = Field(..., description="ID du déploiement")
    result: Literal["success", "failed"] = Field(..., description="Résultat du pipeline CI/CD")
    metrics_endpoint: Optional[HttpUrl] = Field(
        None,
        description="URL pour collecter les métriques POST",
        examples=["https://api.prod.com/ds-metrics"]
    )

class DeploymentFinishResponse(BaseModel):
    status: Literal["accepted"]
    message: str
