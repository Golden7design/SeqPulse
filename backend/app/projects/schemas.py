# app/projects/schemas.py
from pydantic import BaseModel, UUID4
from typing import Optional, List

class ProjectCreate(BaseModel):
    name: str
    description: Optional[str] = None
    envs: List[str] = ["prod"]

class ProjectOut(BaseModel):
    id: UUID4
    name: str
    description: Optional[str] = None
    owner_id: UUID4
    api_key: str
    envs: List[str]
    hmac_enabled: bool

    class Config:
        orm_mode = True

class ProjectHmacSecret(BaseModel):
    hmac_secret: str

    class Config:
        orm_mode = True