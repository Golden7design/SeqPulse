from __future__ import annotations

import time

import pytest
import requests


BASE_URL = "http://localhost:8000"


def _post_login() -> requests.Response:
    payload = {"email": "test@example.com", "password": "wrongpassword"}
    return requests.post(f"{BASE_URL}/auth/login", json=payload, timeout=10)


@pytest.fixture(scope="module")
def server_up() -> None:
    try:
        response = requests.get(f"{BASE_URL}/health", timeout=5)
    except requests.RequestException as exc:
        pytest.skip(f"Serveur non accessible sur {BASE_URL}: {exc}")
    assert response.status_code == 200, f"/health retourne {response.status_code}"


def test_auth_rate_limit(server_up) -> None:
    rate_limited = False

    for _ in range(7):
        response = _post_login()
        assert response.status_code in {401, 404, 429}, response.text
        if response.status_code == 429:
            rate_limited = True
            break
        time.sleep(0.25)

    assert rate_limited, "Aucun 429 observé après 7 requêtes"


def test_deployment_rate_limit(server_up) -> None:
    endpoint = f"{BASE_URL}/deployments/trigger"
    headers = {"X-API-Key": "test_key_invalid"}
    payload = {"env": "prod"}

    statuses: list[int] = []
    for _ in range(10):
        response = requests.post(endpoint, json=payload, headers=headers, timeout=10)
        statuses.append(response.status_code)

    for status_code in statuses:
        assert status_code in {401, 429}, f"Status inattendu: {status_code}"


def test_rate_limit_headers(server_up) -> None:
    response = _post_login()

    required_headers = ["X-RateLimit-Limit", "X-RateLimit-Remaining"]
    for header in required_headers:
        assert header in response.headers, f"Header manquant: {header}"


def test_rate_limit_reset(server_up) -> None:
    response = None
    for _ in range(6):
        response = _post_login()

    assert response is not None
    if response.status_code != 429:
        pytest.skip("Rate limit /auth/login non atteint dans cet environnement")

    retry_after = response.headers.get("Retry-After", "60")
    try:
        wait_seconds = max(1, min(65, int(retry_after) + 1))
    except ValueError:
        wait_seconds = 65

    time.sleep(wait_seconds)

    post_reset = _post_login()
    assert post_reset.status_code != 429, "La limite ne s'est pas réinitialisée"
