from sqlalchemy import BigInteger, Boolean, Column, DateTime, JSON, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import uuid

from app.db.base import Base

class User(Base):
    __tablename__ = "users"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(50), nullable=False)
    email = Column(String, unique=True, nullable=False, index=True)
    hashed_password = Column(String, nullable=False)
    is_active = Column(Boolean, default=True)
    is_superuser = Column(Boolean, default=False)
    twofa_enabled = Column(Boolean, nullable=False, default=False, server_default="false")
    twofa_secret_encrypted = Column(String, nullable=True)
    twofa_enabled_at = Column(DateTime(timezone=True), nullable=True)
    twofa_last_verified_at = Column(DateTime(timezone=True), nullable=True)
    twofa_recovery_codes_hash = Column(JSON, nullable=True)
    twofa_last_totp_step = Column(BigInteger, nullable=True)

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

    projects = relationship(
        "Project",
        back_populates="owner",
        cascade="all, delete-orphan"
    )
    auth_challenges = relationship(
        "AuthChallenge",
        back_populates="user",
        cascade="all, delete-orphan",
    )
