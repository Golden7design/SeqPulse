# app/db/models/metric_sample.py
from sqlalchemy import Column, String, Float, ForeignKey, DateTime, Boolean
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import uuid
from app.db.base import Base

class MetricSample(Base):
    __tablename__ = "metric_samples"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    deployment_id = Column(
        UUID(as_uuid=True),
        ForeignKey("deployments.id", ondelete="CASCADE"),
        nullable=False
    )
    name = Column(String(100), nullable=False)
    value = Column(Float, nullable=False)
    window = Column(String(50), nullable=False)  # "pre" or "post"
    timestamp = Column(DateTime(timezone=True), server_default=func.now())
    is_archived = Column(Boolean, default=False)  # pour le nettoyage futur

    deployment = relationship("Deployment", back_populates="metric_samples")