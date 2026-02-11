# app/db/models/metric_sample.py
from sqlalchemy import Column, Float, String, ForeignKey, DateTime, Index
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import uuid

from app.db.base import Base


class MetricSample(Base):
    __tablename__ = "metric_samples"
    __table_args__ = (
        Index(
            "ix_metric_samples_deployment_phase_collected_at",
            "deployment_id",
            "phase",
            "collected_at",
        ),
        Index(
            "uq_metric_sample",
            "deployment_id",
            "phase",
            "collected_at",
            unique=True,
        ),
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    deployment_id = Column(
        UUID(as_uuid=True),
        ForeignKey("deployments.id", ondelete="CASCADE"),
        nullable=False
    )

    # pre | post
    phase = Column(String(10), nullable=False)

    requests_per_sec = Column(Float, nullable=False)
    latency_p95 = Column(Float, nullable=False)
    error_rate = Column(Float, nullable=False)
    cpu_usage = Column(Float, nullable=False)
    memory_usage = Column(Float, nullable=False)

    collected_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False
    )

    deployment = relationship("Deployment", back_populates="metric_samples")

    def __repr__(self):
        return (
            f"<MetricSample dep={self.deployment_id} "
            f"phase={self.phase} at={self.collected_at}>"
        )
