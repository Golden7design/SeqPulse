# SeqPulse SDK - Documentation Technique

## Vue d'ensemble

Le SDK SeqPulse permet d'intégrer facilement la collecte de métriques dans vos applications. Il expose les métriques de performance au format attendu par SeqPulse et valide les requêtes HMAC pour sécuriser la communication.

## Installation

```bash
# Node.js
npm install seqpulse
# ou
pnpm add seqpulse

# Python
pip install seqpulse
```

## Cas d'utilisation

Le SDK SeqPulse sert à **exposer les métriques de performance** de votre application pour que SeqPulse puisse les collecter et les analyser.

## Fonctionnement détaillé

### 1. Configuration initiale

#### Node.js

```javascript
const seqpulse = require('seqpulse');

seqpulse.init({
  apiKey: 'sp_live_xxxxx',        // API key du projet SeqPulse
  hmacEnabled: true,              // Activer la validation HMAC
  hmacSecret: 'hmac_secret_xxxx', // Secret HMAC (requis si hmacEnabled: true)
  endpoint: '/seqpulse-metrics'   // Optionnel, défaut: /seqpulse-metrics
});
```

#### Python (FastAPI)

```python
from seqpulse import SeqPulse

seqpulse = SeqPulse(
    api_key="sp_live_xxxxx",
    hmac_enabled=True,               # Activer la validation HMAC
    hmac_secret="hmac_secret_xxxx",  # Secret HMAC (requis si hmac_enabled: True)
    endpoint="/seqpulse-metrics"     # Optionnel
)
```

### 2. Intégration dans l'application

#### Node.js avec Express

```javascript
const express = require('express');
const seqpulse = require('seqpulse');

const app = express();

// Configuration
seqpulse.init({
  apiKey: process.env.SEQPULSE_API_KEY,
  hmacEnabled: process.env.SEQPULSE_HMAC_ENABLED === 'true',
  hmacSecret: process.env.SEQPULSE_HMAC_SECRET
});

// Le middleware capture automatiquement les métriques
app.use(seqpulse.metrics());

app.get('/', (req, res) => res.send('Hello World'));
app.listen(3000);
```

#### Python avec FastAPI

```python
from fastapi import FastAPI
from seqpulse import SeqPulseMiddleware

app = FastAPI()
seqpulse = SeqPulseMiddleware(
    api_key="sp_live_xxxxx",
    hmac_enabled=True,
    hmac_secret="hmac_secret_xxxx"
)

app.middleware("http")(seqpulse.middleware())

@app.get("/")
def read_root():
    return {"Hello": "World"}
```

### 3. Ce que fait le SDK en arrière-plan

#### A) Collecte automatique des métriques

À chaque requête HTTP, le SDK calcule et stocke les métriques suivantes :

| Métrique | Description | Calcul |
|----------|-------------|--------|
| `requests_per_sec` | Requêtes par seconde | Compteur / fenêtre de temps |
| `latency_p95` | Latence au 95ème percentile | Percentile 95 des latences |
| `error_rate` | Taux d'erreurs | Erreurs (5xx) / Total requêtes |
| `cpu_usage` | Utilisation CPU | Via `process.cpuUsage()` / `psutil` |
| `memory_usage` | Utilisation mémoire | Via `process.memoryUsage()` / `psutil` |

#### B) Endpoint exposé

Quand SeqPulse appelle `GET /seqpulse-metrics`, le SDK retourne :

```json
{
  "metrics": {
    "requests_per_sec": 150.5,
    "latency_p95": 0.245,
    "error_rate": 0.001,
    "cpu_usage": 0.65,
    "memory_usage": 0.72
  }
}
```

#### C) Validation HMAC (si activé)

Si le projet a activé HMAC dans SeqPulse, le SDK valide les headers de requête :

| Header | Description |
|--------|-------------|
| `X-SeqPulse-Timestamp` | Timestamp ISO 8601 (doit être dans les 5 minutes) |
| `X-SeqPulse-Signature` | Signature HMAC-SHA256 |
| `X-SeqPulse-Nonce` | Chaîne aléatoire unique |
| `X-SeqPulse-Signature-Version` | Version de signature (`v2`) |
| `X-SeqPulse-Canonical-Path` | Path canonique signé |
| `X-SeqPulse-Method` | Méthode HTTP signée (`GET`) |

**Calcul de la signature :**

```
payload = timestamp|METHOD|path|nonce
signature = HMAC-SHA256(secret, payload)
```

Le SDK rejette les requêtes avec :
- Timestamp trop ancien (> 5 min)
- Timestamp trop dans le futur (> 30s)
- Signature invalide
- Nonce réutilisé (protection replay)

### 4. Scope du SDK

Le SDK couvre uniquement :

- l'exposition des métriques (`/seqpulse-metrics`)
- la normalisation/validation des métriques
- la validation HMAC des requêtes entrantes

Le SDK **ne gère pas** le pipeline CI/CD.

## Architecture technique

### Flux de données complet

```
┌─────────────────────────────────────────────────────────────────────┐
│                          SÉQPULSE                                   │
│   Récupère périodiquement les métriques via HTTP GET               │
│   sur l'endpoint exposé par le SDK                                 │
│                                                                     │
│   GET /seqpulse-metrics (avec HMAC si activé)                      │
│   ┌─────────────────────────────────────────────────────────────┐   │
│   │  Headers:                                                    │   │
│   │  - X-SeqPulse-Timestamp: 2026-02-26T15:30:00Z             │   │
│   │  - X-SeqPulse-Signature: sha256=abc123...                  │   │
│   │  - X-SeqPulse-Nonce: random_string                          │   │
│   └─────────────────────────────────────────────────────────────┘   │
│                              │                                      │
│                              ▼                                      │
│   ┌─────────────────────────────────────────────────────────────┐   │
│   │                    APPLICATION DÉVELOPPEUR                    │   │
│   │                                                             │   │
│   │   npm install seqpulse                                      │   │
│   │        │                                                    │   │
│   │        ▼                                                    │   │
│   │   seqpulse.init({ apiKey, hmacSecret })                   │   │
│   │        │                                                    │   │
│   │        ▼                                                    │   │
│   │   app.use(seqpulse.metrics())                               │   │
│   │        │                                                    │   │
│   │        ▼                                                    │   │
│   │   ┌────────────────────────────────────────────────────┐   │   │
│   │   │  1. Middleware capture requêtes                    │   │   │
│   │   │  2. Calcule metrics (latence, erreurs, CPU/RAM)   │   │   │
│   │   │  3. Stocke en mémoire (fenêtre glissante)          │   │   │
│   │   │                                                      │   │   │
│   │   │  GET /seqpulse-metrics →                            │   │   │
│   │   │  { "metrics": { ... } }                             │   │   │
│   │   └────────────────────────────────────────────────────┘   │   │
│   └─────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
```

### Structure des packages

```
seqpulse/
├── packages/
│   ├── seqpulse/                 # Package Node.js (npm)
│   │   ├── src/
│   │   │   ├── index.ts         # Point d'entrée
│   │   │   ├── metrics.ts      # Middleware métriques
│   │   │   ├── hmac.ts         # Validation HMAC
│   │   │   ├── collector.ts    # Calcul des métriques
│   │   │   └── types.ts        # Types et contrats
│   │   ├── package.json
│   │   └── README.md
│   │
│   ├── seqpulse-python/         # Package Python (pip)
│   │   ├── seqpulse/
│   │   │   ├── __init__.py
│   │   │   ├── middleware.py    # Middleware FastAPI/Starlette
│   │   │   ├── hmac.py         # Validation HMAC
│   │   │   ├── collector.py    # Calcul des métriques
│   │   │   └── types.py        # Types et contrats
│   │   ├── setup.py
│   │   └── README.md
│   │
│   └── seqpulse-cli/            # CLI (optionnel)
│       ├── src/
│       ├── package.json
│       └── README.md
│
└── README.md
```

## Référence API

### SeqPulse.init(config)

Configure le SDK.

| Paramètre | Type | Requis | Description |
|-----------|------|--------|-------------|
| `apiKey` | string | Oui | API key du projet SeqPulse |
| `hmacEnabled` | boolean | Non | Activer la validation HMAC (défaut: `false`) |
| `hmacSecret` | string | Conditionally | Secret HMAC (requis si `hmacEnabled: true`) |
| `endpoint` | string | Non | Chemin de l'endpoint métriques (défaut: `/seqpulse-metrics`) |

### seqpulse.metrics() (Node.js)

Middleware Express pour capturer les métriques.

```javascript
app.use(seqpulse.metrics());
```

### SeqPulseMiddleware (Python)

Middleware FastAPI pour capturer les métriques.

```python
app.middleware("http")(seqpulse.middleware())
```

## Métriques collectées

### Format de réponse

```json
{
  "metrics": {
    "requests_per_sec": 150.5,
    "latency_p95": 0.245,
    "error_rate": 0.001,
    "cpu_usage": 0.65,
    "memory_usage": 0.72
  }
}
```

### Validations

| Métrique | Type | Min | Max |
|----------|------|-----|-----|
| `requests_per_sec` | float | 0.0 | ∞ |
| `latency_p95` | float | 0.0 | ∞ |
| `error_rate` | float | 0.0 | 1.0 |
| `cpu_usage` | float | 0.0 | 1.0 |
| `memory_usage` | float | 0.0 | 1.0 |

## Sécurité HMAC

### Activation HMAC

1. Dans le dashboard SeqPulse, aller dans les paramètres du projet
2. Activer "HMAC Security"
3. Copier le secret généré
4. Configurer le SDK :

```javascript
seqpulse.init({
  apiKey: '...',
  hmacEnabled: true,   // ← Important : activer la validation
  hmacSecret: '...'    // Le secretcopié depuis SeqPulse
});
```

### Validation côté SDK

Le SDK vérifie :
1. **Timestamp** : doit être dans les 5 minutes
2. **Signature** : doit correspondre au calcul HMAC-SHA256
3. **Nonce** : ne doit pas avoir été utilisé récemment ( TTL: 5min30s)

### Format de signature v2

```
payload = "2026-02-26T15:30:00Z|GET|/seqpulse-metrics|abc123..."
signature = "sha256=" + HMAC-SHA256(secret, payload)
```

## Dépannage

### Erreurs courantes

| Erreur | Cause | Solution |
|--------|-------|----------|
| `401 Unauthorized` | HMAC activé mais validation échouée | Vérifier `hmacEnabled: true` et le secret HMAC |
| `Timestamp too old` | Requête avec un timestamp dépassé | Vérifier la synchronisation du temps système |
| `Timestamp too far in the future` | Horloge client/serveur désynchronisée | Vérifier NTP et fuseau système |
| `Invalid metrics format` | Métriques hors plage | Vérifier que les valeurs sont dans les ranges valides |

### Debug

Activer les logs de debug :

```javascript
// Node.js
seqpulse.init({
  apiKey: '...',
  debug: true
});
```

```python
# Python
seqpulse = SeqPulse(api_key="...", debug=True)
```

## Exemples complets

### Node.js + Express + TypeScript

```typescript
import express from 'express';
import seqpulse from 'seqpulse';

const app = express();

seqpulse.init({
  apiKey: process.env.SEQPULSE_API_KEY!,
  hmacSecret: process.env.SEQPULSE_HMAC_SECRET,
  endpoint: '/metrics',
  debug: process.env.NODE_ENV === 'development'
});

app.use(seqpulse.metrics());

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`SeqPulse endpoint: /metrics`);
});
```

### Python + FastAPI

```python
from fastapi import FastAPI
from seqpulse import SeqPulseMiddleware
import os

app = FastAPI()

seqpulse = SeqPulseMiddleware(
    api_key=os.getenv("SEQPULSE_API_KEY"),
    hmac_secret=os.getenv("SEQPULSE_HMAC_SECRET"),
    endpoint="/metrics",
    debug=os.getenv("DEBUG") == "true"
)

app.middleware("http")(seqpulse.middleware())

@app.get("/api/health")
def health():
    return {"status": "ok"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=3000)
```

## Notes

- Le SDK utilise une fenêtre glissante de 60 secondes pour calculer les métriques
- Les métriques sont stockées en mémoire et ne persistent pas entre les redémarrages
- Pour les applications stateless, il est recommandé d'utiliser un système de métriques externe (Prometheus, DataDog) en complément
