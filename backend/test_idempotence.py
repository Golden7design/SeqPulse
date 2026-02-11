#!/usr/bin/env python3
"""
Script de test pour vérifier l'idempotence des déploiements.

Usage:
    python test_idempotence.py [API_KEY]

    Ou avec variable d'environnement:
    export SEQPULSE_API_KEY="your_key"
    python test_idempotence.py

Teste:
1. Idempotency-Key → même deployment
2. Un seul running par env (même env, clés différentes)
3. /finish idempotent (accepted puis ignored)
4. Concurrence (même Idempotency-Key)
"""
import requests
import time
import sys
import os
from datetime import datetime


BASE_URL = "http://localhost:8000"
API_KEY = os.getenv("SEQPULSE_API_KEY") or (sys.argv[1] if len(sys.argv) > 1 else None)
ENV = os.getenv("SEQPULSE_ENV", "prod")
COLORS = {
    "green": "\033[92m",
    "red": "\033[91m",
    "yellow": "\033[93m",
    "blue": "\033[94m",
    "reset": "\033[0m",
}


def print_colored(message, color="reset"):
    print(f"{COLORS[color]}{message}{COLORS['reset']}")


def trigger(headers, env, idempotency_key=None):
    payload = {
        "env": env,
        "metrics_endpoint": "https://example.com/metrics",
    }
    if idempotency_key:
        payload["idempotency_key"] = idempotency_key
    return requests.post(f"{BASE_URL}/deployments/trigger", json=payload, headers=headers)


def finish(headers, deployment_id):
    payload = {
        "deployment_id": deployment_id,
        "result": "success",
    }
    return requests.post(f"{BASE_URL}/deployments/finish", json=payload, headers=headers)


def test_idempotency_key():
    """Même Idempotency-Key → même deployment"""
    print_colored("\n=== Test 1: Idempotency-Key ===", "blue")

    headers = {"X-API-Key": API_KEY}
    key = f"run-{int(time.time())}"

    print("\n1. Première requête:")
    response1 = trigger(headers, env=ENV, idempotency_key=key)
    print(f"  Status: {response1.status_code}")

    if response1.status_code != 200:
        print_colored(f"  ✗ Erreur: {response1.text}", "red")
        return False

    data1 = response1.json()
    print(f"  Deployment ID: {data1['deployment_id']}")
    print(f"  Status: {data1['status']}")

    print("\n2. Deuxième requête (même Idempotency-Key):")
    response2 = trigger(headers, env=ENV, idempotency_key=key)
    print(f"  Status: {response2.status_code}")

    if response2.status_code != 200:
        print_colored(f"  ✗ Erreur: {response2.text}", "red")
        return False

    data2 = response2.json()
    print(f"  Deployment ID: {data2['deployment_id']}")
    print(f"  Status: {data2['status']}")

    if data1["deployment_id"] != data2["deployment_id"]:
        print_colored("  ✗ IDs différents (pas idempotent)", "red")
        return False

    print_colored("  ✓ Même deployment_id", "green")

    finish(headers, data1["deployment_id"])
    return True


def test_single_running():
    """Même env, clés différentes → même running"""
    print_colored("\n=== Test 2: Un seul running ===", "blue")

    headers = {"X-API-Key": API_KEY}
    key1 = f"run-a-{int(time.time())}"
    key2 = f"run-b-{int(time.time())}"

    print("\n1. Première requête:")
    response1 = trigger(headers, env=ENV, idempotency_key=key1)
    if response1.status_code != 200:
        print_colored(f"  ✗ Erreur: {response1.text}", "red")
        return False
    data1 = response1.json()

    print("\n2. Deuxième requête (clé différente, même env):")
    response2 = trigger(headers, env=ENV, idempotency_key=key2)
    if response2.status_code != 200:
        print_colored(f"  ✗ Erreur: {response2.text}", "red")
        return False
    data2 = response2.json()

    if data1["deployment_id"] != data2["deployment_id"]:
        print_colored("  ✗ IDs différents (devrait retourner le running)", "red")
        return False

    print_colored("  ✓ Même deployment_id (running unique)", "green")

    finish(headers, data1["deployment_id"])
    return True


def test_finish_idempotent():
    """/finish idempotent: accepted puis ignored"""
    print_colored("\n=== Test 3: Finish Idempotent ===", "blue")

    headers = {"X-API-Key": API_KEY}
    key = f"run-finish-{int(time.time())}"

    response = trigger(headers, env=ENV, idempotency_key=key)
    if response.status_code != 200:
        print_colored(f"  ✗ Erreur: {response.text}", "red")
        return False

    dep_id = response.json()["deployment_id"]

    print("\n1. Finish (doit être accepted):")
    finish1 = finish(headers, dep_id)
    if finish1.status_code != 200:
        print_colored(f"  ✗ Erreur: {finish1.text}", "red")
        return False
    status1 = finish1.json().get("status")
    print(f"  Status: {status1}")

    print("\n2. Finish retry (doit être ignored):")
    finish2 = finish(headers, dep_id)
    if finish2.status_code != 200:
        print_colored(f"  ✗ Erreur: {finish2.text}", "red")
        return False
    status2 = finish2.json().get("status")
    print(f"  Status: {status2}")

    if status1 not in ("accepted", "ignored"):
        print_colored("  ✗ Status inattendu", "red")
        return False
    if status2 != "ignored":
        print_colored("  ✗ Retry finish non ignoré", "red")
        return False

    print_colored("  ✓ Finish idempotent", "green")
    return True


def test_concurrent_requests():
    """Requêtes concurrentes avec même Idempotency-Key"""
    print_colored("\n=== Test 4: Requêtes Concurrentes ===", "blue")
    print_colored("Note: Ce test simule des requêtes quasi-simultanées", "yellow")

    headers = {"X-API-Key": API_KEY}
    key = f"run-concurrent-{int(time.time())}"

    def send_request():
        return trigger(headers, env=ENV, idempotency_key=key)

    import concurrent.futures

    print("\nEnvoi de 3 requêtes quasi-simultanées...")
    with concurrent.futures.ThreadPoolExecutor(max_workers=3) as executor:
        futures = [executor.submit(send_request) for _ in range(3)]
        responses = [f.result() for f in futures]

    deployment_ids = set()
    statuses = []

    for i, response in enumerate(responses, 1):
        print(f"\nRequête {i}:")
        print(f"  Status: {response.status_code}")
        if response.status_code == 200:
            data = response.json()
            print(f"  Deployment ID: {data['deployment_id']}")
            print(f"  Status: {data['status']}")
            deployment_ids.add(data["deployment_id"])
            statuses.append(data["status"])
        else:
            print_colored(f"  ✗ Erreur: {response.text}", "red")

    if len(deployment_ids) != 1:
        print_colored(f"\n✗ Plusieurs déploiements créés: {deployment_ids}", "red")
        return False

    created_count = statuses.count("created")
    existing_count = statuses.count("existing")
    print(f"\nStatuses: {created_count} created, {existing_count} existing")

    if created_count >= 1 and (created_count + existing_count) == 3:
        print_colored("✓ Résultats attendus", "green")
    else:
        print_colored("✗ Résultats inattendus", "red")
        return False

    finish(headers, list(deployment_ids)[0])
    return True


def main():
    print_colored("=" * 60, "blue")
    print_colored("  SeqPulse Idempotence - Test Suite", "blue")
    print_colored("=" * 60, "blue")
    print(f"\nBase URL: {BASE_URL}")
    print(f"Timestamp: {datetime.now().isoformat()}")
    print(f"Env: {ENV}")

    if not API_KEY:
        print_colored("\n❌ API key manquante!", "red")
        print_colored("\nUtilisation:", "yellow")
        print("  python test_idempotence.py [API_KEY]")
        print("  ou")
        print("  export SEQPULSE_API_KEY='your_api_key'")
        print("  python test_idempotence.py")
        return

    print_colored(f"✓ API key configurée: {API_KEY[:8]}...", "green")

    try:
        response = requests.get(f"{BASE_URL}/health", timeout=5)
        if response.status_code == 200:
            print_colored("✓ Serveur accessible", "green")
        else:
            print_colored(f"⚠ Serveur répond avec status {response.status_code}", "yellow")
    except requests.exceptions.RequestException as e:
        print_colored(f"❌ Serveur inaccessible: {e}", "red")
        print_colored("\nAssurez-vous que:", "yellow")
        print("  1. Le serveur tourne sur http://localhost:8000")
        print("  2. La migration SQL a été exécutée")
        return

    results = []
    results.append(("Idempotency-Key", test_idempotency_key()))
    results.append(("Un seul running", test_single_running()))
    results.append(("Finish idempotent", test_finish_idempotent()))
    results.append(("Concurrence", test_concurrent_requests()))

    print_colored("\n" + "=" * 60, "blue")
    print_colored("  RÉSUMÉ", "blue")
    print_colored("=" * 60, "blue")

    passed = sum(1 for _, result in results if result)
    total = len(results)

    for test_name, result in results:
        status = "✅ PASS" if result else "❌ FAIL"
        color = "green" if result else "red"
        print_colored(f"  {status} - {test_name}", color)

    print(f"\nRésultat: {passed}/{total} tests passés")

    if passed == total:
        print_colored("\n🎉 Tous les tests sont passés!", "green")
    else:
        print_colored(f"\n⚠ {total - passed} test(s) échoué(s)", "red")


if __name__ == "__main__":
    main()
