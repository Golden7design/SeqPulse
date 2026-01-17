from sqlalchemy import Column, String, ForeignKey, DateTime, Boolean, Integer
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
import uuid
from sqlalchemy.sql import func

from app.db.base import Base

class Subscription(Base):
    __tablename__ = "subscriptions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    project_id = Column(UUID(as_uuid=True), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, unique=True)
    plan = Column(String(50), nullable=False, default="free")  # free / pro
    is_active = Column(Boolean, default=True)
    max_envs = Column(Integer, default=1)  # free:1, pro:3
    stripe_subscription_id = Column(String(100), nullable=True, unique=True)
    current_period_end = Column(DateTime, nullable=True)
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
    project = relationship("Project", back_populates="subscription")