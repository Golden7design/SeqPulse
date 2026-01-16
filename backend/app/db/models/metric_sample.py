from sqlalchemy import Column, String, Float, ForeignKey, DateTime
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
import uuid
from datetime import datetime, timezone

from app.db.base import Base

class MetricSample(Base):
    __tablename__ = "metric_samples"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    deployment_id = Column(UUID(as_uuid=True), ForeignKey("deployments.id", ondelete="CASCADE"), nullable=False)
    name = Column(String(100), nullable=False)  # ex: 'http_5xx_rate'
    value = Column(Float, nullable=False)
    window = Column(String(50), nullable=False, default="post")  # pre / post
    timestamp = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    source = Column(String(50), default="http_endpoint")  # ajouté

    deployment = relationship("Deployment", back_populates="metric_samples")