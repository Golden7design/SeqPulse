from sqlalchemy import Column, String, ForeignKey, DateTime
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
import uuid
from datetime import datetime

from app.db.base import Base

class Deployment(Base):
    __tablename__ = "deployments"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    project_id = Column(UUID(as_uuid=True), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    env = Column(String(50), nullable=False)  # dev / staging / prod
    status = Column(String(50), nullable=False, default="pending")  # pending / success / failed
    start_time = Column(DateTime, default=datetime.utcnow)
    end_time = Column(DateTime, nullable=True)

    project = relationship("Project", back_populates="deployments")
    metric_samples = relationship("MetricSample", back_populates="deployment", cascade="all, delete-orphan")