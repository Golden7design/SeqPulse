from datetime import datetime, timedelta, timezone
from typing import Any

from fastapi import Request, Response
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.auth import routes as auth_routes
from app.auth.schemas import UserCreate
from app.db.models.user import User
from app.email.types import EMAIL_TYPE_NO_PROJECT_AFTER_SIGNUP, EMAIL_TYPE_WELCOME_SIGNUP


def _make_request(path: str) -> Request:
    scope: dict[str, Any] = {
        "type": "http",
        "http_version": "1.1",
        "method": "POST",
        "scheme": "http",
        "path": path,
        "raw_path": path.encode("latin-1"),
        "query_string": b"",
        "headers": [(b"user-agent", b"pytest-auth-email")],
        "client": ("127.0.0.1", 12345),
        "server": ("testserver", 80),
    }
    return Request(scope)


def _call_unwrapped(func, *args, **kwargs):
    target = getattr(func, "__wrapped__", func)
    return target(*args, **kwargs)


def _db_session() -> Session:
    engine = create_engine(
        "sqlite+pysqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    SessionLocal = sessionmaker(bind=engine, autocommit=False, autoflush=False)
    User.__table__.create(bind=engine)
    return SessionLocal()


def test_signup_schedules_welcome_and_no_project_emails(monkeypatch):
    db = _db_session()
    scheduled_calls: list[dict[str, Any]] = []

    def _fake_schedule_email(_db, **kwargs):
        scheduled_calls.append(kwargs)
        return None

    monkeypatch.setattr(auth_routes, "schedule_email", _fake_schedule_email)

    try:
        request = _make_request("/auth/signup")
        response = Response()
        payload = UserCreate(
            name="Nassir Diallo",
            email="nassir.signup@example.com",
            password="StrongP@ssw0rd",
        )

        created_user = _call_unwrapped(auth_routes.signup, request, response, payload, db)

        assert created_user.email == "nassir.signup@example.com"
        assert len(scheduled_calls) == 2

        first = scheduled_calls[0]
        second = scheduled_calls[1]

        assert first["email_type"] == EMAIL_TYPE_WELCOME_SIGNUP
        assert first["to_email"] == "nassir.signup@example.com"
        assert first["dedupe_key"] == f"welcome_signup:{created_user.id}"
        assert first["scheduled_at"] is None
        assert first["context"]["first_name"] == "Nassir"

        assert second["email_type"] == EMAIL_TYPE_NO_PROJECT_AFTER_SIGNUP
        assert second["to_email"] == "nassir.signup@example.com"
        assert second["dedupe_key"] == f"no_project_after_signup:{created_user.id}"
        assert second["context"]["first_name"] == "Nassir"
        assert isinstance(second["scheduled_at"], datetime)
        assert second["scheduled_at"].tzinfo is not None
        assert second["scheduled_at"] >= datetime.now(timezone.utc) + timedelta(hours=1, minutes=59)
    finally:
        db.close()
