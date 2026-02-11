# app/db/models/deployment.py
from sqlalchemy import Column, String, ForeignKey, DateTime, Integer, Index, text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import uuid

from app.db.base import Base


class Deployment(Base):
    __tablename__ = "deployments"
    __table_args__ = (
        Index("ix_deployments_project_started_at", "project_id", "started_at"),
        Index("ix_deployments_state", "state"),
        # Un seul deployment running par (projet, env)
        Index(
            "uq_running_deployment",
            "project_id",
            "env",
            unique=True,
            postgresql_where=text("state = 'running'"),
        ),
        # Idempotency-Key unique si fourni
        Index(
            "uq_deployments_idempotency_key",
            "idempotency_key",
            unique=True,
            postgresql_where=text("idempotency_key IS NOT NULL"),
        ),
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    project_id = Column(
        UUID(as_uuid=True),
        ForeignKey("projects.id", ondelete="CASCADE"),
        nullable=False
    )

    env = Column(String(50), nullable=False)
    
    # Idempotence: clé opaque fournie par le CI/CD
    idempotency_key = Column(String(255), nullable=True)
    
    # Optionnel: branche Git
    branch = Column(String(255), nullable=True)

    # État interne SeqPulse
    # pending → running → finished → analyzed
    state = Column(String(20), nullable=False, default="pending")

    # Résultat pipeline CI/CD
    # success | failed | cancelled
    pipeline_result = Column(String(20), nullable=True)

    started_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False
    )

    finished_at = Column(DateTime(timezone=True), nullable=True)

    duration_ms = Column(Integer, nullable=True)

    # Relations
    project = relationship("Project", back_populates="deployments")

    metric_samples = relationship(
        "MetricSample",
        back_populates="deployment",
        cascade="all, delete-orphan"
    )

    verdict = relationship(
        "DeploymentVerdict",
        back_populates="deployment",
        uselist=False,
        cascade="all, delete-orphan"
    )

    sdh_hints = relationship(
        "SDHHint",
        back_populates="deployment",
        cascade="all, delete-orphan"
    )

    def __repr__(self):
        return (
            f"<Deployment id={self.id} env={self.env} "
            f"state={self.state} pipeline_result={self.pipeline_result}>"
        )
