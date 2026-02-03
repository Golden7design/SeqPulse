from sqlalchemy import Column, String, Float, ForeignKey, DateTime, Text, ARRAY
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import uuid

from app.db.base import Base


class SDHHint(Base):
    __tablename__ = "sdh_hints"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    deployment_id = Column(
        UUID(as_uuid=True),
        ForeignKey("deployments.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    metric = Column(String(50), nullable=False)
    severity = Column(String(20), nullable=False)
    observed_value = Column(Float, nullable=True)
    threshold = Column(Float, nullable=True)
    confidence = Column(Float, nullable=False, default=0.5)
    title = Column(String(255), nullable=False)
    diagnosis = Column(Text, nullable=False)
    suggested_actions = Column(ARRAY(String), nullable=False, default=list)
    created_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    deployment = relationship("Deployment", back_populates="sdh_hints")
