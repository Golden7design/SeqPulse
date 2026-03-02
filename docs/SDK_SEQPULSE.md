# SeqPulse SDK - Documentation Technique (v0.2.0)

## Vue d'ensemble

Le SDK SeqPulse sert a:

- exposer un endpoint metrics HTTP
- normaliser les metrics dans le format attendu par SeqPulse
- valider les appels entrants via HMAC v2 (optionnel)

Le SDK ne gere pas la logique pipeline (`/deployments/trigger`, `/deployments/finish`).

## Installation

```bash
# Node.js
npm install seqpulse
# ou
pnpm add seqpulse

# Python
pip install seqpulse
```

## Quickstart

### Node.js (Express)

```javascript
const express = require("express")
const seqpulse = require("seqpulse")

const app = express()

seqpulse.init({
  endpoint: "/seqpulse-metrics",
  hmacEnabled: process.env.SEQPULSE_HMAC_ENABLE === "true",
  hmacSecret: process.env.SEQPULSE_HMAC_SECRET,
})

app.use(seqpulse.metrics())
app.get("/", (_req, res) => res.send("ok"))
app.listen(3000)
```

### Python (FastAPI)

```python
import os
from fastapi import FastAPI
from seqpulse import SeqPulse

app = FastAPI()

seqpulse = SeqPulse(
    endpoint="/seqpulse-metrics",
    hmac_enabled=os.getenv("SEQPULSE_HMAC_ENABLE", "false").lower() == "true",
    hmac_secret=os.getenv("SEQPULSE_HMAC_SECRET"),
)

app.middleware("http")(seqpulse.middleware())
```

## Variables d'environnement recommandees

### CI/CD platform (GitHub Actions, Jenkins, etc.)

```bash
SEQPULSE_API_KEY=sp_xxx
SEQPULSE_BASE_URL=https://api.seqpulse.io
SEQPULSE_METRICS_ENDPOINT=https://your-app.example.com/seqpulse-metrics
```

### App hosting runtime (Render, Vercel, etc.)

```bash
SEQPULSE_HMAC_ENABLE=true
SEQPULSE_HMAC_SECRET=hmac_xxx
```

## Contrat de metrics

`GET /seqpulse-metrics` retourne:

```json
{
  "metrics": {
    "requests_per_sec": 0.25,
    "latency_p95": 31.221,
    "error_rate": 0.0,
    "cpu_usage": 0.42,
    "memory_usage": 0.18
  }
}
```

## HMAC v2

Headers verifies quand HMAC est active:

- `X-SeqPulse-Timestamp`
- `X-SeqPulse-Signature`
- `X-SeqPulse-Nonce`
- `X-SeqPulse-Signature-Version` (`v2`)
- `X-SeqPulse-Canonical-Path`
- `X-SeqPulse-Method`

Signature:

```text
payload = timestamp|METHOD|path|nonce
signature = "sha256=" + HMAC_SHA256(secret, payload)
```

## API reference (v0.2.0)

### Node: `seqpulse.init(config)`

| Parametre | Type | Requis | Description |
|---|---|---|---|
| `endpoint` | string | Non | Path metrics (defaut: `/seqpulse-metrics`) |
| `hmacEnabled` | boolean | Non | Active la validation HMAC |
| `hmacSecret` | string | Conditionnel | Requis si `hmacEnabled=true` |
| `maxSkewPastSeconds` | number | Non | Tolere timestamp passe (defaut: 300) |
| `maxSkewFutureSeconds` | number | Non | Tolere timestamp futur (defaut: 30) |
| `apiKey` | string | Non | Optionnel (legacy), non utilise pour metrics/HMAC |

### Python: `SeqPulse(...)`

| Parametre | Type | Requis | Description |
|---|---|---|---|
| `endpoint` | string | Non | Path metrics (defaut: `/seqpulse-metrics`) |
| `hmac_enabled` | bool | Non | Active la validation HMAC |
| `hmac_secret` | string | Conditionnel | Requis si `hmac_enabled=True` |
| `max_skew_past_seconds` | int | Non | Tolere timestamp passe (defaut: 300) |
| `max_skew_future_seconds` | int | Non | Tolere timestamp futur (defaut: 30) |
| `api_key` | string | Non | Optionnel (legacy), non utilise pour metrics/HMAC |

## Notes importantes

- Depuis `v0.2.0`, `apiKey`/`api_key` est optionnel.
- La fenetre de sampling SDK est fixe a **60 secondes**.
- Les metrics sont stockees en memoire (reset au redemarrage).
