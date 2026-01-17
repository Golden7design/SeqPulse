from pydantic import BaseModel
from typing import Optional

class ProjectCreate(BaseModel):
    name: str
    description: Optional[str] = None
    envs: list[str] = ["prod"]


class ProjectOut(BaseModel):
    id: str
    name: str
    description: Optional[str] = None
    owner_id: str
    api_key: str
    envs: list[str] = ["prod"]
    owner_id: str