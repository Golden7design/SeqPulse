# app/db/models/project.py
from sqlalchemy import (
    ARRAY,
    Boolean,
    CheckConstraint,
    Column,
    DateTime,
    ForeignKey,
    Integer,
    String,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import uuid

from app.db.base import Base


class Project(Base):
    __tablename__ = "projects"
    __table_args__ = (
        CheckConstraint(
            "endpoint_state IN ('pending_verification', 'active', 'blocked')",
            name="ck_projects_endpoint_state",
        ),
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(100), nullable=False)
    description = Column(String(255), nullable=True)
    tech_stack = Column(String(255), nullable=True)

    owner_id = Column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )

    api_key = Column(
        String(255),
        unique=True,
        nullable=False,
        index=True
    )

    envs = Column(ARRAY(String), nullable=False, default=["prod"])

    # Contrôle business SeqPulse
    # free | pro | enterprise
    plan = Column(String(20), nullable=False, default="free")
    observation_window_minutes = Column(Integer, nullable=True)

    created_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False
    )

    updated_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False
    )

    slack_enabled = Column(Boolean, default=False, nullable=False)
    slack_webhook_url = Column(String(1024), nullable=True)
    slack_channel = Column(String(255), nullable=True)

    hmac_enabled = Column(Boolean, default=False, nullable=False)
    hmac_secret = Column(String, unique=True, nullable=False)

    # Endpoint lock (source de vérité endpoint metrics)
    metrics_endpoint_candidate = Column(String(2048), nullable=True)
    metrics_endpoint_active = Column(String(2048), nullable=True)
    endpoint_state = Column(
        String(32),
        nullable=False,
        default="pending_verification",
        server_default="pending_verification",
    )
    endpoint_host_lock = Column(String(255), nullable=True)
    endpoint_change_count = Column(Integer, nullable=False, default=0, server_default="0")
    endpoint_migration_count = Column(Integer, nullable=False, default=0, server_default="0")
    endpoint_last_verified_at = Column(DateTime(timezone=True), nullable=True)
    endpoint_last_test_error_code = Column(String(64), nullable=True)
    baseline_version = Column(Integer, nullable=False, default=1, server_default="1")

    # Relations
    owner = relationship("User", back_populates="projects")
    subscription = relationship(
        "Subscription",
        back_populates="project",
        uselist=False,
        cascade="all, delete-orphan"
    )
    deployments = relationship(
        "Deployment",
        back_populates="project",
        cascade="all, delete-orphan"
    )
    endpoint_events = relationship(
        "ProjectEndpointEvent",
        back_populates="project",
        cascade="all, delete-orphan",
    )

    def __repr__(self):
        return f"<Project id={self.id} name={self.name} plan={self.plan}>"
