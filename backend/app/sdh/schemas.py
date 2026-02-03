from datetime import datetime
from typing import List, Literal, Optional

from pydantic import BaseModel


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
    created_at: datetime
