# app/projects/schemas.py
from datetime import datetime
from pydantic import BaseModel, UUID4
from typing import Optional, List, Literal

class ProjectCreate(BaseModel):
    name: str
    description: Optional[str] = None
    tech_stack: Optional[str] = None
    envs: List[str] = ["prod"]

class ProjectOut(BaseModel):
    id: UUID4
    name: str
    description: Optional[str] = None
    tech_stack: Optional[str] = None
    owner_id: UUID4
    api_key: str
    envs: List[str]
    hmac_enabled: bool

    class Config:
        orm_mode = True


class ProjectPublicOut(BaseModel):
    id: str
    internal_id: str
    project_number: int
    name: str
    description: Optional[str] = None
    tech_stack: Optional[str] = None
    api_key: str
    envs: List[str]
    hmac_enabled: bool


class ProjectLastDeploymentOut(BaseModel):
    id: str
    deployment_number: int
    verdict: Literal["ok", "warning", "rollback_recommended"]
    finished_at: datetime


class ProjectStatsOut(BaseModel):
    deployments_total: int
    ok_count: int
    warning_count: int
    rollback_count: int


class ProjectDashboardOut(BaseModel):
    id: str
    internal_id: str
    project_number: int
    name: str
    env: str
    plan: Literal["free", "pro", "enterprise"]
    hmac_enabled: bool
    stack: List[str]
    last_deployment: ProjectLastDeploymentOut
    stats: ProjectStatsOut
    created_at: datetime


class ProjectHmacSecret(BaseModel):
    hmac_secret: str

    class Config:
        orm_mode = True
