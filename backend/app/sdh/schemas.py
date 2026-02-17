from datetime import datetime
from typing import List, Literal, Optional

from pydantic import BaseModel, Field


class SDHSignalOut(BaseModel):
    metric: str
    observed_value: Optional[float] = None
    threshold: Optional[float] = None


class SDHOut(BaseModel):
    id: str
    deployment_id: str
    project: str
    env: str
    severity: Literal["critical", "warning", "info"]
    metric: str
    observed_value: Optional[float] = None
    threshold: Optional[float] = None
    confidence: float
    title: str
    diagnosis: str
    suggested_actions: List[str]
    composite_signals: List[SDHSignalOut] = Field(default_factory=list)
    created_at: datetime
