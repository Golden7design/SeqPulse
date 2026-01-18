# app/db/models/deployment_verdict.py
from sqlalchemy import Column, String, Float, ForeignKey, DateTime, ARRAY
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import uuid
from app.db.base import Base

class DeploymentVerdict(Base):
    __tablename__ = "deployment_verdicts"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    deployment_id = Column(
        UUID(as_uuid=True),
        ForeignKey("deployments.id", ondelete="CASCADE"),
        unique=True,
        nullable=False
    )
    verdict = Column(String(50), nullable=False)  # "ok", "attention", "rollback_recommended"
    confidence = Column(Float, nullable=False)
    summary = Column(String(255), nullable=False)
    details = Column(ARRAY(String), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    deployment = relationship("Deployment", back_populates="verdict")