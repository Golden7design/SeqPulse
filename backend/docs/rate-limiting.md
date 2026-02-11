# Rate Limiting - SeqPulse API

**Date:** 2026-02-06  
**Version:** 1.0  
**Status:** ✅ Implémenté

---

## 📋 Vue d'Ensemble

SeqPulse implémente un **rate limiting** (limitation de débit) pour protéger l'API contre :
- Les bugs clients (boucles infinies, retries agressifs)
- Les attaques DDoS (Distributed Denial of Service)
- L'abus de ressources serveur
- Les tentatives de brute force sur l'authentification

---

## 🎯 Limites par Type d'Endpoint

### 1. Authentification (`/auth/*`)
**Limite:** `5 requêtes/minute` par IP

**Endpoints concernés:**
- `POST /auth/signup`
- `POST /auth/login`

**Raison:** Prévention des attaques par brute force sur les mots de passe.

**Exemple de réponse si limite dépassée:**
```http
HTTP/1.1 429 Too Many Requests
X-RateLimit-Limit: 5
X-RateLimit-Remaining: 0
X-RateLimit-Reset: 1675890060
Retry-After: 60

{
  "error": "Rate limit exceeded: 5 per 1 minute"
}
```

---

### 2. Déploiements (`/deployments/*`)
**Limite:** `100 requêtes/minute` par API Key

**Endpoints concernés:**
- `POST /deployments/trigger`
- `POST /deployments/finish`

**Raison:** Protection contre les déploiements excessifs et les retries agressifs.

**Identification:** Par `X-API-Key` header (si présent), sinon par IP.

---

### 3. Métriques Publiques (à venir)
**Limite:** `10 requêtes/minute` par IP

**Endpoints concernés:**
- `GET /ds-metrics` (endpoint public pour collecte de métriques)

**Raison:** Endpoint le plus vulnérable aux abus, car appelé fréquemment par les clients.

---

### 4. Dashboard/UI (`/projects/*`, `/sdh/*`)
**Limite:** `1000 requêtes/minute` par utilisateur

**Raison:** Utilisateurs humains, risque faible d'abus.

---

### 5. Limite Globale (Fallback)
**Limite:** `1000 requêtes/heure` pour tous les endpoints non spécifiés

---

## 🔑 Identification des Clients

Le rate limiting identifie les clients selon cette priorité :

1. **API Key** (header `X-API-Key`) → Préféré pour les endpoints authentifiés
2. **IP Address** → Fallback pour les endpoints publics

**Exemple:**
```bash
# Avec API Key (limite par projet)
curl -H "X-API-Key: sk_live_abc123..." \
     https://api.seqpulse.dev/deployments/trigger

# Sans API Key (limite par IP)
curl https://api.seqpulse.dev/auth/login
```

---

## 📊 Headers de Réponse

Chaque réponse inclut des headers informatifs :

```http
X-RateLimit-Limit: 100          # Limite maximale
X-RateLimit-Remaining: 87       # Requêtes restantes
X-RateLimit-Reset: 1675890120   # Timestamp Unix de reset
```

**Calcul du temps restant:**
```python
import time
reset_timestamp = 1675890120
seconds_until_reset = reset_timestamp - time.time()
print(f"Retry dans {seconds_until_reset} secondes")
```

---

## ⚠️ Gestion des Erreurs 429

### Réponse HTTP 429
```json
{
  "error": "Rate limit exceeded: 100 per 1 minute"
}
```

### Bonnes Pratiques Client

#### ✅ Bon : Exponential Backoff
```python
import time
import requests

def call_api_with_retry(url, max_retries=3):
    for attempt in range(max_retries):
        response = requests.post(url)
        
        if response.status_code == 429:
            retry_after = int(response.headers.get("Retry-After", 60))
            print(f"Rate limited. Waiting {retry_after}s...")
            time.sleep(retry_after)
            continue
        
        return response
    
    raise Exception("Max retries exceeded")
```

#### ❌ Mauvais : Retry Immédiat
```python
# NE PAS FAIRE ÇA !
while True:
    try:
        response = requests.post(url)
        break
    except:
        # Retry immédiat = aggrave le problème
        continue
```

---

## 🛠️ Configuration Technique

### Architecture
- **Librairie:** `slowapi` (wrapper FastAPI pour flask-limiter)
- **Storage:** In-memory (simple, pas de Redis nécessaire pour MVP)
- **Stratégie:** Fixed Window (fenêtre fixe)

### Fichiers Modifiés
- `app/core/rate_limit.py` - Configuration du limiter
- `app/main.py` - Intégration globale
- `app/deployments/routes.py` - Limites sur déploiements
- `app/auth/routes.py` - Limites sur authentification

### Exemple de Configuration
```python
# app/core/rate_limit.py
from slowapi import Limiter

limiter = Limiter(
    key_func=get_api_key_or_ip,
    default_limits=["1000/hour"],
    storage_uri="memory://",
    strategy="fixed-window",
)

RATE_LIMITS = {
    "auth": "5/minute",
    "deployments": "100/minute",
    "dashboard": "1000/minute",
}
```

---

## 📈 Monitoring

### Métriques à Surveiller
- Nombre de requêtes 429 par endpoint
- Top clients dépassant les limites
- Distribution des requêtes par API key

### Logs
```
2026-02-06 10:30:45 WARNING Rate limit exceeded for IP 192.168.1.100 on /auth/login
2026-02-06 10:31:12 WARNING Rate limit exceeded for API key sk_live_abc123 on /deployments/trigger
```

---

## 🔧 Ajustement des Limites

### Augmenter les Limites (Production)
Si les limites actuelles sont trop restrictives :

```python
# app/core/rate_limit.py
RATE_LIMITS = {
    "deployments": "200/minute",  # Augmenté de 100 à 200
}
```

### Limites Personnalisées par Plan
```python
# Future: Limites différentes selon plan Free/Pro
def get_rate_limit_for_project(project):
    if project.plan == "pro":
        return "500/minute"
    return "100/minute"
```

---

## 🚀 Migration vers Redis (Future)

Pour une production à grande échelle, migrer vers Redis :

```python
# app/core/rate_limit.py
limiter = Limiter(
    key_func=get_api_key_or_ip,
    storage_uri="redis://localhost:6379",  # Au lieu de memory://
    strategy="fixed-window",
)
```

**Avantages:**
- Partage des limites entre plusieurs instances backend
- Persistence des compteurs en cas de restart
- Meilleure performance sous haute charge

---

## ❓ FAQ

### Q: Que se passe-t-il si je dépasse la limite ?
**R:** Vous recevez une erreur HTTP 429. Attendez le temps indiqué dans `Retry-After` avant de réessayer.

### Q: Les limites sont-elles partagées entre environnements ?
**R:** Non, chaque environnement (dev, staging, prod) a ses propres compteurs.

### Q: Puis-je demander une augmentation de limite ?
**R:** Oui, contactez support@seqpulse.dev avec votre use case.

### Q: Le rate limiting affecte-t-il les webhooks ?
**R:** Non, les webhooks entrants ne sont pas limités (mais validés par HMAC).

---

## 📝 Changelog

### 2026-02-06 - v1.0 (Initial)
- ✅ Implémentation initiale avec slowapi
- ✅ Limites sur `/auth/*` (5/min)
- ✅ Limites sur `/deployments/*` (100/min)
- ✅ Identification par API Key ou IP
- ✅ Headers informatifs (X-RateLimit-*)
- ✅ Documentation complète

---

## 🔗 Références

- [slowapi Documentation](https://slowapi.readthedocs.io/)
- [RFC 6585 - HTTP 429 Status Code](https://tools.ietf.org/html/rfc6585)
- [Best Practices for API Rate Limiting](https://cloud.google.com/architecture/rate-limiting-strategies-techniques)
