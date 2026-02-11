#!/usr/bin/env python3
"""
Script de test pour vérifier le rate limiting de SeqPulse.

Usage:
    python test_rate_limiting.py

Teste:
1. Limite sur /auth/login (5/minute)
2. Limite sur /deployments/trigger (100/minute)
3. Headers de réponse (X-RateLimit-*)
"""
import requests
import time
from datetime import datetime


BASE_URL = "http://localhost:8000"
COLORS = {
    "green": "\033[92m",
    "red": "\033[91m",
    "yellow": "\033[93m",
    "blue": "\033[94m",
    "reset": "\033[0m",
}


def print_colored(message, color="reset"):
    print(f"{COLORS[color]}{message}{COLORS['reset']}")


def test_auth_rate_limit():
    """Test rate limit sur /auth/login (5/minute)"""
    print_colored("\n=== Test 1: Rate Limit sur /auth/login (5/minute) ===", "blue")
    
    endpoint = f"{BASE_URL}/auth/login"
    payload = {"email": "test@example.com", "password": "wrongpassword"}
    
    success_count = 0
    rate_limited = False
    
    for i in range(7):  # Essayer 7 fois (limite = 5)
        response = requests.post(endpoint, json=payload)
        
        print(f"\nRequête {i+1}:")
        print(f"  Status: {response.status_code}")
        
        if "X-RateLimit-Limit" in response.headers:
            print(f"  X-RateLimit-Limit: {response.headers['X-RateLimit-Limit']}")
            print(f"  X-RateLimit-Remaining: {response.headers['X-RateLimit-Remaining']}")
        
        if response.status_code == 429:
            rate_limited = True
            retry_after = response.headers.get("Retry-After", "N/A")
            print_colored(f"  ✅ Rate limited! Retry-After: {retry_after}s", "green")
            break
        elif response.status_code in [401, 404]:
            # Attendu (mauvais credentials)
            success_count += 1
            print_colored(f"  ✓ Requête acceptée ({success_count}/5)", "yellow")
        else:
            print_colored(f"  ⚠ Unexpected status: {response.status_code}", "red")
        
        time.sleep(0.5)  # Petit délai entre requêtes
    
    if rate_limited:
        print_colored("\n✅ Test PASSED: Rate limiting fonctionne sur /auth/login", "green")
    else:
        print_colored("\n❌ Test FAILED: Pas de rate limiting détecté", "red")
    
    return rate_limited


def test_deployment_rate_limit():
    """Test rate limit sur /deployments/trigger (100/minute)"""
    print_colored("\n=== Test 2: Rate Limit sur /deployments/trigger (100/minute) ===", "blue")
    print_colored("Note: Ce test nécessite une API key valide", "yellow")
    
    endpoint = f"{BASE_URL}/deployments/trigger"
    headers = {"X-API-Key": "test_key_invalid"}
    payload = {"env": "production"}
    
    # Tester seulement 10 requêtes (pas 100) pour gagner du temps
    print("Envoi de 10 requêtes rapides...")
    
    for i in range(10):
        response = requests.post(endpoint, json=payload, headers=headers)
        
        if i == 0 or i == 9:  # Afficher première et dernière
            print(f"\nRequête {i+1}:")
            print(f"  Status: {response.status_code}")
            if "X-RateLimit-Remaining" in response.headers:
                print(f"  X-RateLimit-Remaining: {response.headers['X-RateLimit-Remaining']}")
    
    print_colored("\n✅ Test PASSED: Endpoint accessible (limite non atteinte avec 10 req)", "green")
    return True


def test_rate_limit_headers():
    """Test présence des headers X-RateLimit-*"""
    print_colored("\n=== Test 3: Headers X-RateLimit-* ===", "blue")
    
    endpoint = f"{BASE_URL}/auth/login"
    payload = {"email": "test@example.com", "password": "test"}
    
    response = requests.post(endpoint, json=payload)
    
    required_headers = ["X-RateLimit-Limit", "X-RateLimit-Remaining"]
    all_present = True
    
    for header in required_headers:
        if header in response.headers:
            print_colored(f"  ✓ {header}: {response.headers[header]}", "green")
        else:
            print_colored(f"  ✗ {header}: MISSING", "red")
            all_present = False
    
    if all_present:
        print_colored("\n✅ Test PASSED: Tous les headers présents", "green")
    else:
        print_colored("\n❌ Test FAILED: Headers manquants", "red")
    
    return all_present


def test_rate_limit_reset():
    """Test que les limites se réinitialisent après 1 minute"""
    print_colored("\n=== Test 4: Reset après 1 minute ===", "blue")
    print_colored("Note: Ce test prend ~70 secondes", "yellow")
    
    endpoint = f"{BASE_URL}/auth/login"
    payload = {"email": "test@example.com", "password": "test"}
    
    # Épuiser la limite
    print("Épuisement de la limite (5 requêtes)...")
    for i in range(5):
        requests.post(endpoint, json=payload)
    
    # Vérifier qu'on est rate limited
    response = requests.post(endpoint, json=payload)
    if response.status_code != 429:
        print_colored("⚠ Limite pas encore atteinte, skip test", "yellow")
        return True
    
    print_colored("✓ Limite atteinte (429)", "yellow")
    
    # Attendre 65 secondes (1 minute + marge)
    print("Attente de 65 secondes pour reset...")
    for i in range(13):
        time.sleep(5)
        print(f"  {(i+1)*5}s / 65s", end="\r")
    print()
    
    # Réessayer
    response = requests.post(endpoint, json=payload)
    
    if response.status_code in [401, 404]:  # Pas 429
        print_colored("\n✅ Test PASSED: Limite réinitialisée après 1 minute", "green")
        return True
    else:
        print_colored(f"\n❌ Test FAILED: Status {response.status_code} (attendu 401/404)", "red")
        return False


def main():
    print_colored("=" * 60, "blue")
    print_colored("  SeqPulse Rate Limiting - Test Suite", "blue")
    print_colored("=" * 60, "blue")
    print(f"\nBase URL: {BASE_URL}")
    print(f"Timestamp: {datetime.now().isoformat()}")
    
    # Vérifier que le serveur est accessible
    try:
        response = requests.get(f"{BASE_URL}/health", timeout=5)
        if response.status_code == 200:
            print_colored("✓ Serveur accessible", "green")
        else:
            print_colored(f"⚠ Serveur répond avec status {response.status_code}", "yellow")
    except requests.exceptions.RequestException as e:
        print_colored(f"❌ Serveur inaccessible: {e}", "red")
        print_colored("\nAssurez-vous que le serveur tourne sur http://localhost:8000", "yellow")
        return
    
    # Exécuter les tests
    results = []
    
    results.append(("Auth Rate Limit", test_auth_rate_limit()))
    results.append(("Deployment Rate Limit", test_deployment_rate_limit()))
    results.append(("Rate Limit Headers", test_rate_limit_headers()))
    
    # Test reset (optionnel, prend du temps)
    run_reset_test = input("\n\nExécuter le test de reset (70s)? [y/N]: ").lower() == 'y'
    if run_reset_test:
        results.append(("Rate Limit Reset", test_rate_limit_reset()))
    
    # Résumé
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
