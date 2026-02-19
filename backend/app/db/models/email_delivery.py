from sqlalchemy import JSON, Column, DateTime, ForeignKey, Index, String, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.sql import func
import uuid

from app.db.base import Base


class EmailDelivery(Base):
    __tablename__ = "email_deliveries"
    __table_args__ = (
        Index("ix_email_deliveries_user_id", "user_id"),
        Index("ix_email_deliveries_project_id", "project_id"),
        Index("ix_email_deliveries_email_type", "email_type"),
        Index("ix_email_deliveries_created_at", "created_at"),
        Index("ix_email_deliveries_sent_at", "sent_at"),
        Index("uq_email_deliveries_dedupe_key", "dedupe_key", unique=True),
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )
    project_id = Column(
        UUID(as_uuid=True),
        ForeignKey("projects.id", ondelete="SET NULL"),
        nullable=True,
    )
    email_type = Column(String(40), nullable=False)
    dedupe_key = Column(String(255), nullable=False)
    status = Column(String(20), nullable=False, default="queued", server_default="queued")
    provider_message_id = Column(String(255), nullable=True)
    payload_json = Column(JSON().with_variant(JSONB, "postgresql"), nullable=True)
    error_message = Column(Text, nullable=True)
    sent_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())

    def __repr__(self):
        return (
            f"<EmailDelivery id={self.id} user_id={self.user_id} "
            f"email_type={self.email_type} status={self.status}>"
        )
