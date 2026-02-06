# app/db/models/project.py
from sqlalchemy import Boolean, Column, String, ForeignKey, DateTime, ARRAY
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import uuid

from app.db.base import Base


class Project(Base):
    __tablename__ = "projects"

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
    hmac_enabled = Column(Boolean, default=False, nullable=False)
    hmac_secret = Column(String, unique=True, nullable=False) 

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

    def __repr__(self):
        return f"<Project id={self.id} name={self.name} plan={self.plan}>"
