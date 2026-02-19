# app/db/models/scheduled_job.py
from sqlalchemy import Column, String, Integer, DateTime, Text, Index
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.sql import func
import uuid

from app.db.base import Base


class ScheduledJob(Base):
    __tablename__ = "scheduled_jobs"
    __table_args__ = (
        Index("ix_scheduled_jobs_status_scheduled_at", "status", "scheduled_at"),
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    deployment_id = Column(UUID(as_uuid=True), nullable=True, index=True)
    job_type = Column(String(50), nullable=False)  # 'pre_collect', 'post_collect', 'analysis'
    phase = Column(String(20), nullable=True)  # 'pre', 'post' (null pour analysis)
    sequence_index = Column(Integer, nullable=True)  # 0,1,2... pour multiple post collections
    scheduled_at = Column(DateTime(timezone=True), nullable=False, index=True)
    status = Column(String(20), nullable=False, default='pending', index=True)  # pending/running/completed/failed
    retry_count = Column(Integer, nullable=False, default=0)
    last_error = Column(Text, nullable=True)
    job_metadata = Column(JSONB, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), onupdate=func.now(), nullable=True)

    def __repr__(self):
        return (
            f"<ScheduledJob id={self.id} deployment_id={self.deployment_id} "
            f"job_type={self.job_type} phase={self.phase} status={self.status}>"
        )
