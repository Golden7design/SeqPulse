# app/db/models/deployment.py
from sqlalchemy import Column, String, ForeignKey, DateTime, Integer
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import uuid
from app.db.base import Base

class Deployment(Base):
    __tablename__ = "deployments"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    project_id = Column(
        UUID(as_uuid=True),
        ForeignKey("projects.id", ondelete="CASCADE"),
        nullable=False
    )
    env = Column(String(50), nullable=False)
    status = Column(String(50), nullable=False, default="pending")  # pending → running → success/failed → analyzed
    started_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    finished_at = Column(DateTime(timezone=True), nullable=True)
    duration_ms = Column(Integer, nullable=True)

    # Relations
    project = relationship("Project", back_populates="deployments")
    metric_samples = relationship("MetricSample", back_populates="deployment", cascade="all, delete-orphan")
    verdict = relationship("DeploymentVerdict", back_populates="deployment", uselist=False)