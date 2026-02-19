from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any

from sqlalchemy import MetaData, Table, func, inspect, select
from sqlalchemy.orm import Session

from app.db.models.deployment import Deployment
from app.db.models.deployment_verdict import DeploymentVerdict
from app.db.models.email_delivery import EmailDelivery
from app.db.models.project import Project
from app.db.models.user import User
from app.email.types import EMAIL_TYPE_CRITICAL_VERDICT_ALERT

CONVERSION_EMAIL_TYPES = {"E-CONV-01", "E-CONV-03"}


def compute_window_bounds(window_days: int, *, now: datetime | None = None) -> tuple[datetime, datetime, int]:
    raw_days = 7 if window_days is None else int(window_days)
    normalized_days = max(1, min(90, raw_days))
    window_end = (now or datetime.now(timezone.utc)).astimezone(timezone.utc)
    window_start = window_end - timedelta(days=normalized_days)
    return window_start, window_end, normalized_days


def compute_lifecycle_kpis(db: Session, *, window_start: datetime, window_end: datetime) -> dict[str, Any]:
    signup_num, signup_den = _signup_to_project_24h(db, window_start=window_start, window_end=window_end)
    verdict_num, verdict_den = _project_to_first_verdict_72h(db, window_start=window_start, window_end=window_end)
    conv_num, conv_den = _free_to_pro_from_quota_emails(db, window_start=window_start, window_end=window_end)
    critical = _critical_alert_open_rate(db, window_start=window_start, window_end=window_end)

    return {
        "signup_to_project_24h": _kpi_payload(numerator=signup_num, denominator=signup_den),
        "project_to_first_verdict_72h": _kpi_payload(numerator=verdict_num, denominator=verdict_den),
        "free_to_pro_from_quota_emails": _kpi_payload(numerator=conv_num, denominator=conv_den),
        "critical_alert_open_rate": critical,
    }


def _signup_to_project_24h(db: Session, *, window_start: datetime, window_end: datetime) -> tuple[int, int]:
    cohort = _query_user_signup_cohort(db, window_start=window_start, window_end=window_end)
    denominator = len(cohort)
    if denominator == 0:
        return 0, 0

    owner_ids = [user_id for user_id, _ in cohort]
    projects = _query_projects_for_owners(
        db,
        owner_ids=owner_ids,
        created_before=window_end + timedelta(hours=24),
    )

    first_project_at_by_owner: dict[Any, datetime] = {}
    for owner_id, created_at in projects:
        ts = _as_utc(created_at)
        current = first_project_at_by_owner.get(owner_id)
        if current is None or ts < current:
            first_project_at_by_owner[owner_id] = ts

    numerator = 0
    for user_id, user_created_at in cohort:
        created_at = _as_utc(user_created_at)
        first_project_at = first_project_at_by_owner.get(user_id)
        if first_project_at is not None and first_project_at <= created_at + timedelta(hours=24):
            numerator += 1
    return numerator, denominator


def _project_to_first_verdict_72h(db: Session, *, window_start: datetime, window_end: datetime) -> tuple[int, int]:
    cohort = _query_project_cohort(db, window_start=window_start, window_end=window_end)
    denominator = len(cohort)
    if denominator == 0:
        return 0, 0

    project_ids = [project_id for project_id, _ in cohort]
    verdict_rows = _query_verdict_times_for_projects(
        db,
        project_ids=project_ids,
        created_before=window_end + timedelta(hours=72),
    )

    first_verdict_at_by_project: dict[Any, datetime] = {}
    for project_id, verdict_created_at in verdict_rows:
        ts = _as_utc(verdict_created_at)
        current = first_verdict_at_by_project.get(project_id)
        if current is None or ts < current:
            first_verdict_at_by_project[project_id] = ts

    numerator = 0
    for project_id, project_created_at in cohort:
        created_at = _as_utc(project_created_at)
        first_verdict_at = first_verdict_at_by_project.get(project_id)
        if first_verdict_at is not None and first_verdict_at <= created_at + timedelta(hours=72):
            numerator += 1
    return numerator, denominator


def _free_to_pro_from_quota_emails(db: Session, *, window_start: datetime, window_end: datetime) -> tuple[int, int]:
    exposed_project_ids = _query_exposed_projects(db, window_start=window_start, window_end=window_end)
    denominator = len(exposed_project_ids)
    if denominator == 0:
        return 0, 0

    numerator = _count_converted_exposed_projects(db, project_ids=exposed_project_ids)
    return int(numerator), denominator


def _critical_alert_open_rate(db: Session, *, window_start: datetime, window_end: datetime) -> dict[str, Any]:
    if not _has_table(db, "email_events"):
        return {
            "value": None,
            "numerator": None,
            "denominator": None,
            "available": False,
            "reason": "email_events_table_missing",
        }

    sent_ids = (
        db.query(EmailDelivery.id)
        .filter(
            EmailDelivery.email_type == EMAIL_TYPE_CRITICAL_VERDICT_ALERT,
            EmailDelivery.status == "sent",
            EmailDelivery.sent_at.isnot(None),
            EmailDelivery.sent_at >= window_start,
            EmailDelivery.sent_at <= window_end,
        )
        .all()
    )
    sent_ids = [row[0] for row in sent_ids]
    denominator = len(sent_ids)
    if denominator == 0:
        return {
            "value": 0.0,
            "numerator": 0,
            "denominator": 0,
            "available": True,
            "reason": None,
        }

    metadata = MetaData()
    email_events = Table("email_events", metadata, autoload_with=db.get_bind())
    required_columns = {"email_delivery_id", "event_type"}
    if not required_columns.issubset(set(email_events.columns.keys())):
        return {
            "value": None,
            "numerator": None,
            "denominator": denominator,
            "available": False,
            "reason": "email_events_schema_incomplete",
        }

    opened_count = db.execute(
        select(func.count(func.distinct(email_events.c.email_delivery_id))).where(
            email_events.c.event_type == "opened",
            email_events.c.email_delivery_id.in_(sent_ids),
        )
    ).scalar()
    numerator = int(opened_count or 0)
    return {
        "value": _percent(numerator=numerator, denominator=denominator),
        "numerator": numerator,
        "denominator": denominator,
        "available": True,
        "reason": None,
    }


def _query_user_signup_cohort(db: Session, *, window_start: datetime, window_end: datetime):
    return (
        db.query(User.id, User.created_at)
        .filter(
            User.created_at >= window_start,
            User.created_at <= window_end,
        )
        .all()
    )


def _query_projects_for_owners(db: Session, *, owner_ids: list[Any], created_before: datetime):
    if not owner_ids:
        return []
    return (
        db.query(Project.owner_id, Project.created_at)
        .filter(
            Project.owner_id.in_(owner_ids),
            Project.created_at <= created_before,
        )
        .all()
    )


def _query_project_cohort(db: Session, *, window_start: datetime, window_end: datetime):
    return (
        db.query(Project.id, Project.created_at)
        .filter(
            Project.created_at >= window_start,
            Project.created_at <= window_end,
        )
        .all()
    )


def _query_verdict_times_for_projects(db: Session, *, project_ids: list[Any], created_before: datetime):
    if not project_ids:
        return []
    return (
        db.query(Deployment.project_id, DeploymentVerdict.created_at)
        .join(Deployment, Deployment.id == DeploymentVerdict.deployment_id)
        .filter(
            Deployment.project_id.in_(project_ids),
            DeploymentVerdict.created_at <= created_before,
        )
        .all()
    )


def _query_exposed_projects(db: Session, *, window_start: datetime, window_end: datetime) -> list[Any]:
    rows = (
        db.query(EmailDelivery.project_id)
        .filter(
            EmailDelivery.project_id.isnot(None),
            EmailDelivery.email_type.in_(sorted(CONVERSION_EMAIL_TYPES)),
            EmailDelivery.status == "sent",
            EmailDelivery.sent_at.isnot(None),
            EmailDelivery.sent_at >= window_start,
            EmailDelivery.sent_at <= window_end,
        )
        .distinct()
        .all()
    )
    return [row[0] for row in rows if row[0] is not None]


def _count_converted_exposed_projects(db: Session, *, project_ids: list[Any]) -> int:
    if not project_ids:
        return 0
    count = (
        db.query(Project.id)
        .filter(
            Project.id.in_(project_ids),
            Project.plan == "pro",
        )
        .count()
    )
    return int(count or 0)


def _kpi_payload(*, numerator: int, denominator: int) -> dict[str, Any]:
    return {
        "value": _percent(numerator=numerator, denominator=denominator),
        "numerator": numerator,
        "denominator": denominator,
    }


def _percent(*, numerator: int, denominator: int) -> float:
    if denominator <= 0:
        return 0.0
    return round((100.0 * numerator) / denominator, 2)


def _has_table(db: Session, table_name: str) -> bool:
    return table_name in inspect(db.get_bind()).get_table_names()


def _as_utc(value: datetime) -> datetime:
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc)
