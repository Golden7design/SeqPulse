from __future__ import annotations

import concurrent.futures
import os
import uuid

import pytest
import requests


BASE_URL = "http://localhost:8000"
ENV = os.getenv("SEQPULSE_ENV", "prod")


@pytest.fixture(scope="module")
def server_up() -> None:
    try:
        response = requests.get(f"{BASE_URL}/health", timeout=5)
    except requests.RequestException as exc:
        pytest.skip(f"Serveur non accessible sur {BASE_URL}: {exc}")
    assert response.status_code == 200, f"/health retourne {response.status_code}"


@pytest.fixture(scope="module")
def api_headers(server_up) -> dict[str, str]:
    api_key = os.getenv("SEQPULSE_API_KEY")
    if not api_key:
        pytest.skip("SEQPULSE_API_KEY n'est pas définie")
    return {"X-API-Key": api_key}


def trigger(headers: dict[str, str], env: str, idempotency_key: str | None = None) -> requests.Response:
    payload = {"env": env}
    request_headers = dict(headers)
    if idempotency_key:
        request_headers["X-Idempotency-Key"] = idempotency_key
    return requests.post(
        f"{BASE_URL}/deployments/trigger",
        json=payload,
        headers=request_headers,
        timeout=15,
    )


def _response_detail(response: requests.Response) -> str | None:
    try:
        payload = response.json()
    except ValueError:
        return None
    if isinstance(payload, dict):
        detail = payload.get("detail")
        if isinstance(detail, str):
            return detail
    return None


def trigger_or_skip(headers: dict[str, str], env: str, idempotency_key: str) -> requests.Response:
    response = trigger(headers, env=env, idempotency_key=idempotency_key)
    detail = _response_detail(response)
    if response.status_code == 423 and detail == "PROJECT_ENDPOINT_BLOCKED":
        pytest.skip("Projet non prêt: metrics endpoint actif non verrouillé")
    if response.status_code == 409 and detail == "ENDPOINT_MISMATCH":
        pytest.skip("Projet non prêt: endpoint payload incompatible avec endpoint actif")
    return response


def finish(headers: dict[str, str], deployment_id: str) -> requests.Response:
    payload = {
        "deployment_id": deployment_id,
        "result": "success",
    }
    return requests.post(
        f"{BASE_URL}/deployments/finish",
        json=payload,
        headers=headers,
        timeout=15,
    )


def test_idempotency_key(api_headers: dict[str, str]) -> None:
    key = f"run-{uuid.uuid4().hex}"

    response1 = trigger_or_skip(api_headers, env=ENV, idempotency_key=key)
    assert response1.status_code == 200, response1.text
    data1 = response1.json()
    deployment_id = data1["deployment_id"]

    response2 = trigger_or_skip(api_headers, env=ENV, idempotency_key=key)
    assert response2.status_code == 200, response2.text
    data2 = response2.json()

    assert data1["deployment_id"] == data2["deployment_id"]

    finish_response = finish(api_headers, deployment_id)
    assert finish_response.status_code == 200, finish_response.text


def test_single_running(api_headers: dict[str, str]) -> None:
    key1 = f"run-a-{uuid.uuid4().hex}"
    key2 = f"run-b-{uuid.uuid4().hex}"

    response1 = trigger_or_skip(api_headers, env=ENV, idempotency_key=key1)
    assert response1.status_code == 200, response1.text
    data1 = response1.json()
    deployment_id = data1["deployment_id"]

    response2 = trigger_or_skip(api_headers, env=ENV, idempotency_key=key2)
    assert response2.status_code == 200, response2.text
    data2 = response2.json()

    assert data1["deployment_id"] == data2["deployment_id"]

    finish_response = finish(api_headers, deployment_id)
    assert finish_response.status_code == 200, finish_response.text


def test_finish_idempotent(api_headers: dict[str, str]) -> None:
    key = f"run-finish-{uuid.uuid4().hex}"

    response = trigger_or_skip(api_headers, env=ENV, idempotency_key=key)
    assert response.status_code == 200, response.text
    deployment_id = response.json()["deployment_id"]

    finish1 = finish(api_headers, deployment_id)
    assert finish1.status_code == 200, finish1.text
    status1 = finish1.json().get("status")

    finish2 = finish(api_headers, deployment_id)
    assert finish2.status_code == 200, finish2.text
    status2 = finish2.json().get("status")

    assert status1 in {"accepted", "ignored"}
    assert status2 == "ignored"


def test_concurrent_requests(api_headers: dict[str, str]) -> None:
    key = f"run-concurrent-{uuid.uuid4().hex}"

    def send_request() -> requests.Response:
        return trigger(api_headers, env=ENV, idempotency_key=key)

    with concurrent.futures.ThreadPoolExecutor(max_workers=3) as executor:
        futures = [executor.submit(send_request) for _ in range(3)]
        responses = [future.result() for future in futures]

    for response in responses:
        detail = _response_detail(response)
        if response.status_code == 423 and detail == "PROJECT_ENDPOINT_BLOCKED":
            pytest.skip("Projet non prêt: metrics endpoint actif non verrouillé")
        if response.status_code == 409 and detail == "ENDPOINT_MISMATCH":
            pytest.skip("Projet non prêt: endpoint payload incompatible avec endpoint actif")
        assert response.status_code == 200, response.text

    payloads = [response.json() for response in responses]
    deployment_ids = {payload["deployment_id"] for payload in payloads}
    statuses = {payload["status"] for payload in payloads}

    assert len(deployment_ids) == 1
    assert statuses.issubset({"created", "existing"})

    finish_response = finish(api_headers, payloads[0]["deployment_id"])
    assert finish_response.status_code == 200, finish_response.text
