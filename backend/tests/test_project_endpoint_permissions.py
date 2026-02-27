from datetime import datetime, timedelta, timezone
from types import SimpleNamespace
from uuid import uuid4

import pytest
from fastapi import HTTPException

from app.projects import routes as project_routes


def _user(**overrides):
    data = {
        "id": uuid4(),
        "is_superuser": False,
        "twofa_enabled": False,
        "twofa_last_verified_at": None,
    }
    data.update(overrides)
    return SimpleNamespace(**data)


def _project(owner_id):
    return SimpleNamespace(owner_id=owner_id)


def test_recent_reauth_not_required_when_twofa_is_disabled():
    user = _user(twofa_enabled=False)
    project_routes._assert_recent_reauth(current_user=user)


def test_recent_reauth_required_when_twofa_enabled_without_recent_verification():
    user = _user(twofa_enabled=True, twofa_last_verified_at=None)

    with pytest.raises(HTTPException) as exc_info:
        project_routes._assert_recent_reauth(current_user=user)

    assert exc_info.value.status_code == 401
    assert exc_info.value.detail == "REAUTH_REQUIRED"


def test_recent_reauth_required_when_twofa_verification_is_too_old():
    user = _user(
        twofa_enabled=True,
        twofa_last_verified_at=datetime.now(timezone.utc) - timedelta(minutes=60),
    )

    with pytest.raises(HTTPException) as exc_info:
        project_routes._assert_recent_reauth(current_user=user)

    assert exc_info.value.status_code == 401
    assert exc_info.value.detail == "REAUTH_REQUIRED"


def test_recent_reauth_passes_with_fresh_twofa_verification():
    user = _user(
        twofa_enabled=True,
        twofa_last_verified_at=datetime.now(timezone.utc) - timedelta(minutes=2),
    )
    project_routes._assert_recent_reauth(current_user=user)


def test_endpoint_mutation_permissions_reject_non_owner_non_admin():
    owner_id = uuid4()
    user = _user(id=uuid4(), is_superuser=False, twofa_enabled=False)
    project = _project(owner_id=owner_id)

    with pytest.raises(HTTPException) as exc_info:
        project_routes._assert_project_endpoint_mutation_permissions(
            current_user=user,
            project=project,
        )

    assert exc_info.value.status_code == 403
    assert exc_info.value.detail == "INSUFFICIENT_ROLE"


def test_endpoint_mutation_permissions_allow_superuser_with_recent_reauth():
    owner_id = uuid4()
    user = _user(
        id=uuid4(),
        is_superuser=True,
        twofa_enabled=True,
        twofa_last_verified_at=datetime.now(timezone.utc),
    )
    project = _project(owner_id=owner_id)

    project_routes._assert_project_endpoint_mutation_permissions(
        current_user=user,
        project=project,
    )
