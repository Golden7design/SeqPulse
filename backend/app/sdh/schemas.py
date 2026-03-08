from datetime import datetime
from typing import List, Literal, Optional, Any, Dict

from pydantic import BaseModel, Field


class SDHSignalOut(BaseModel):
    metric: str
    observed_value: Optional[float] = None
    threshold: Optional[float] = None
    secured_threshold: Optional[float] = None
    exceed_ratio: Optional[float] = None
    tolerance: Optional[float] = None


class LocalizedTextOut(BaseModel):
    key: Optional[str] = None
    params: Dict[str, Any] = Field(default_factory=dict)
    fallback: str


class SDHOut(BaseModel):
    id: str
    deployment_id: str
    project: str
    env: str
    severity: Literal["critical", "warning", "info"]
    metric: str
    observed_value: Optional[float] = None
    threshold: Optional[float] = None
    secured_threshold: Optional[float] = None
    exceed_ratio: Optional[float] = None
    tolerance: Optional[float] = None
    confidence: float
    title: str
    diagnosis: str
    suggested_actions: List[str]
    title_i18n: Optional[LocalizedTextOut] = None
    diagnosis_i18n: Optional[LocalizedTextOut] = None
    suggested_actions_i18n: List[LocalizedTextOut] = Field(default_factory=list)
    composite_signals: List[SDHSignalOut] = Field(default_factory=list)
    created_at: datetime
