from pydantic import BaseModel
from typing import Optional
from uuid import UUID
from datetime import datetime

class DeploymentCreate(BaseModel):
    env: str  # ex: "dev", "preview", "prod"

class DeploymentOut(BaseModel):
    id: UUID
    project_id: UUID
    env: str
    status: str
    start_time: datetime
    end_time: Optional[datetime] = None

    class Config:
        orm_mode = True

class DeploymentUpdate(BaseModel):
    status: str  # ex: "ok", "warning", "critical"
    end_time: Optional[datetime] = None  # si non fourni, on peut utiliser func.now()
