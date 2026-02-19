from uuid import uuid4

import pytest
from sqlalchemy import create_engine, text
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.core.security import get_password_hash
from app.db.models.email_delivery import EmailDelivery
from app.db.models.user import User
from app.email import service as email_service
from app.email.types import (
    EMAIL_TYPE_CRITICAL_VERDICT_ALERT,
    EMAIL_TYPE_FREE_QUOTA_80,
    EMAIL_TYPE_NO_PROJECT_AFTER_SIGNUP,
)


@pytest.fixture
def db_session() -> Session:
    engine = create_engine(
        "sqlite+pysqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    SessionLocal = sessionmaker(bind=engine, autocommit=False, autoflush=False)

    User.__table__.create(bind=engine)
    with engine.begin() as connection:
        connection.execute(text("CREATE TABLE projects (id UUID PRIMARY KEY, owner_id UUID NOT NULL)"))
    EmailDelivery.__table__.create(bind=engine)

    session = SessionLocal()
    try:
        yield session
    finally:
        session.close()
        engine.dispose()


def _create_user(db: Session, email: str = "test@example.com") -> User:
    user = User(
        name="Email Tester",
        email=email,
        hashed_password=get_password_hash("StrongP@ssw0rd"),
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def test_send_email_if_not_sent_deduplicates(monkeypatch, db_session: Session):
    user = _create_user(db_session)
    monkeypatch.setattr(email_service, "_send_via_provider", lambda **_kwargs: "msg_001")

    first = email_service.send_email_if_not_sent(
        db_session,
        user_id=str(user.id),
        to_email=user.email,
        email_type=EMAIL_TYPE_NO_PROJECT_AFTER_SIGNUP,
        dedupe_key="act01:user-1:2026-02-19",
        project_id=None,
        context={"first_name": "Nassir"},
    )
    second = email_service.send_email_if_not_sent(
        db_session,
        user_id=str(user.id),
        to_email=user.email,
        email_type=EMAIL_TYPE_NO_PROJECT_AFTER_SIGNUP,
        dedupe_key="act01:user-1:2026-02-19",
        project_id=None,
        context={"first_name": "Nassir"},
    )

    assert first.status == "sent"
    assert second.status == "skipped_dedup"
    assert db_session.query(EmailDelivery).count() == 1


def test_send_email_if_not_sent_applies_marketing_cooldown(monkeypatch, db_session: Session):
    user = _create_user(db_session, email="cooldown@example.com")
    monkeypatch.setattr(email_service, "_send_via_provider", lambda **_kwargs: "msg_002")

    first = email_service.send_email_if_not_sent(
        db_session,
        user_id=str(user.id),
        to_email=user.email,
        email_type=EMAIL_TYPE_FREE_QUOTA_80,
        dedupe_key=f"conv01:{uuid4()}",
        project_id=None,
        context={"project_name": "Checkout API", "deployments_used": 42},
    )
    second = email_service.send_email_if_not_sent(
        db_session,
        user_id=str(user.id),
        to_email=user.email,
        email_type=EMAIL_TYPE_NO_PROJECT_AFTER_SIGNUP,
        dedupe_key=f"act01:{uuid4()}",
        project_id=None,
        context={"first_name": "Nassir"},
    )

    assert first.status == "sent"
    assert second.status == "suppressed"
    statuses = [row.status for row in db_session.query(EmailDelivery).order_by(EmailDelivery.created_at.asc()).all()]
    assert statuses == ["sent", "suppressed"]


def test_critical_email_bypasses_marketing_cooldown(monkeypatch, db_session: Session):
    user = _create_user(db_session, email="critical@example.com")
    monkeypatch.setattr(email_service, "_send_via_provider", lambda **_kwargs: "msg_003")

    marketing = email_service.send_email_if_not_sent(
        db_session,
        user_id=str(user.id),
        to_email=user.email,
        email_type=EMAIL_TYPE_NO_PROJECT_AFTER_SIGNUP,
        dedupe_key=f"act01:{uuid4()}",
        project_id=None,
        context={"first_name": "Nassir"},
    )
    critical = email_service.send_email_if_not_sent(
        db_session,
        user_id=str(user.id),
        to_email=user.email,
        email_type=EMAIL_TYPE_CRITICAL_VERDICT_ALERT,
        dedupe_key=f"act05:{uuid4()}",
        project_id=None,
        context={"project_name": "Checkout API", "verdict": "rollback_recommended"},
    )

    assert marketing.status == "sent"
    assert critical.status == "sent"


def test_send_email_failure_marks_delivery_failed(monkeypatch, db_session: Session):
    user = _create_user(db_session, email="failure@example.com")

    def _boom(**_kwargs):
        raise RuntimeError("provider unavailable")

    monkeypatch.setattr(email_service, "_send_via_provider", _boom)

    result = email_service.send_email_if_not_sent(
        db_session,
        user_id=str(user.id),
        to_email=user.email,
        email_type=EMAIL_TYPE_NO_PROJECT_AFTER_SIGNUP,
        dedupe_key=f"act01:{uuid4()}",
        project_id=None,
        context={"first_name": "Nassir"},
    )

    assert result.status == "failed"
    failed_row = db_session.query(EmailDelivery).first()
    assert failed_row is not None
    assert failed_row.status == "failed"
    assert "provider unavailable" in (failed_row.error_message or "")


def test_no_project_email_is_suppressed_when_user_already_has_project(monkeypatch, db_session: Session):
    user = _create_user(db_session, email="has-project@example.com")
    project_id = str(uuid4())
    db_session.execute(
        text("INSERT INTO projects (id, owner_id) VALUES (:id, :owner_id)"),
        {"id": project_id, "owner_id": str(user.id)},
    )
    db_session.commit()

    provider_calls = {"count": 0}

    def _fake_provider(**_kwargs):
        provider_calls["count"] += 1
        return "msg_should_not_send"

    monkeypatch.setattr(email_service, "_send_via_provider", _fake_provider)

    result = email_service.send_email_if_not_sent(
        db_session,
        user_id=str(user.id),
        to_email=user.email,
        email_type=EMAIL_TYPE_NO_PROJECT_AFTER_SIGNUP,
        dedupe_key=f"act01:{uuid4()}",
        project_id=None,
        context={"first_name": "Nassir"},
    )

    assert result.status == "suppressed"
    assert result.reason == "project_already_created"
    assert provider_calls["count"] == 0


def test_existing_queued_delivery_is_resumed_and_sent(monkeypatch, db_session: Session):
    user = _create_user(db_session, email="resume-queued@example.com")

    queued = EmailDelivery(
        user_id=user.id,
        project_id=None,
        email_type=EMAIL_TYPE_NO_PROJECT_AFTER_SIGNUP,
        dedupe_key="resume:queued:1",
        status="queued",
        payload_json={"to_email": user.email},
    )
    db_session.add(queued)
    db_session.commit()

    provider_calls = {"count": 0}

    def _fake_provider(**_kwargs):
        provider_calls["count"] += 1
        return "msg_resume_queued"

    monkeypatch.setattr(email_service, "_send_via_provider", _fake_provider)

    result = email_service.send_email_if_not_sent(
        db_session,
        user_id=str(user.id),
        to_email=user.email,
        email_type=EMAIL_TYPE_NO_PROJECT_AFTER_SIGNUP,
        dedupe_key="resume:queued:1",
        project_id=None,
        context={"first_name": "Nassir"},
    )

    db_session.refresh(queued)
    assert result.status == "sent"
    assert provider_calls["count"] == 1
    assert queued.status == "sent"
    assert queued.provider_message_id == "msg_resume_queued"


def test_existing_failed_delivery_is_resumed_and_sent(monkeypatch, db_session: Session):
    user = _create_user(db_session, email="resume-failed@example.com")

    failed = EmailDelivery(
        user_id=user.id,
        project_id=None,
        email_type=EMAIL_TYPE_NO_PROJECT_AFTER_SIGNUP,
        dedupe_key="resume:failed:1",
        status="failed",
        payload_json={"to_email": user.email},
        error_message="previous provider error",
    )
    db_session.add(failed)
    db_session.commit()

    monkeypatch.setattr(email_service, "_send_via_provider", lambda **_kwargs: "msg_resume_failed")

    result = email_service.send_email_if_not_sent(
        db_session,
        user_id=str(user.id),
        to_email=user.email,
        email_type=EMAIL_TYPE_NO_PROJECT_AFTER_SIGNUP,
        dedupe_key="resume:failed:1",
        project_id=None,
        context={"first_name": "Nassir"},
    )

    db_session.refresh(failed)
    assert result.status == "sent"
    assert failed.status == "sent"
    assert failed.provider_message_id == "msg_resume_failed"
    assert failed.error_message is None


def test_email_type_disabled_by_rollout_is_suppressed(monkeypatch, db_session: Session):
    user = _create_user(db_session, email="rollout-disabled@example.com")
    monkeypatch.setattr(email_service.settings, "EMAIL_ENABLED_TYPES", "E-TRX-01,E-ACT-04")

    provider_calls = {"count": 0}

    def _fake_provider(**_kwargs):
        provider_calls["count"] += 1
        return "msg_should_not_send"

    monkeypatch.setattr(email_service, "_send_via_provider", _fake_provider)

    result = email_service.send_email_if_not_sent(
        db_session,
        user_id=str(user.id),
        to_email=user.email,
        email_type=EMAIL_TYPE_NO_PROJECT_AFTER_SIGNUP,
        dedupe_key=f"rollout:disabled:{uuid4()}",
        project_id=None,
        context={"first_name": "Nassir"},
    )

    assert result.status == "suppressed"
    assert result.reason == "rollout_disabled"
    assert provider_calls["count"] == 0


def test_existing_queued_delivery_respects_rollout_disable(monkeypatch, db_session: Session):
    user = _create_user(db_session, email="rollout-queued@example.com")
    queued = EmailDelivery(
        user_id=user.id,
        project_id=None,
        email_type=EMAIL_TYPE_NO_PROJECT_AFTER_SIGNUP,
        dedupe_key="rollout:queued:disabled:1",
        status="queued",
        payload_json={},
    )
    db_session.add(queued)
    db_session.commit()

    monkeypatch.setattr(email_service.settings, "EMAIL_ENABLED_TYPES", "E-TRX-01")

    result = email_service.send_email_if_not_sent(
        db_session,
        user_id=str(user.id),
        to_email=user.email,
        email_type=EMAIL_TYPE_NO_PROJECT_AFTER_SIGNUP,
        dedupe_key="rollout:queued:disabled:1",
        project_id=None,
        context={"first_name": "Nassir"},
    )

    db_session.refresh(queued)
    assert result.status == "suppressed"
    assert result.reason == "rollout_disabled"
    assert queued.status == "suppressed"
