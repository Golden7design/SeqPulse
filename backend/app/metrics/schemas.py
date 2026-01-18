# app/metrics/schemas.py
from pydantic import BaseModel
from uuid import UUID
from typing import Optional

class MetricCreate(BaseModel):
    deployment_id: UUID
    name: str
    value: float
