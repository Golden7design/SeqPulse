# SDK Post-Release Smoke Tests (Projet Vierge)

## Objectif

Valider rapidement, après publication, que:

1. l'installation depuis registre public fonctionne
2. le runtime SDK (`/seqpulse-metrics`) fonctionne
3. la couche CI (`trigger/finish`) fonctionne

Version cible: `0.3.0`

---

## A) Node.js - Projet vierge

## 1) Setup projet

```bash
mkdir -p /tmp/seqpulse-smoke-node-030
cd /tmp/seqpulse-smoke-node-030
printf '{"name":"seqpulse-smoke-node-030","version":"1.0.0"}\n' > package.json
npm i seqpulse@0.3.0 express
```

## 2) Smoke runtime (`/seqpulse-metrics`)

Créer `runtime-smoke.js`:

```js
const express = require("express");
const seqpulse = require("seqpulse");

const app = express();

seqpulse.init({
  endpoint: "/seqpulse-metrics",
  hmacEnabled: false,
});

app.use(seqpulse.metrics());
app.get("/health", (_req, res) => res.status(200).send("ok"));

const server = app.listen(3210, async () => {
  try {
    await fetch("http://127.0.0.1:3210/health");
    const response = await fetch("http://127.0.0.1:3210/seqpulse-metrics");
    const json = await response.json();
    if (!json.metrics || typeof json.metrics.requests_per_sec !== "number") {
      throw new Error("metrics payload invalide");
    }
    console.log("Node runtime smoke: OK");
  } catch (e) {
    console.error("Node runtime smoke: FAIL", e);
    process.exitCode = 1;
  } finally {
    server.close();
  }
});
```

Exécuter:

```bash
node runtime-smoke.js
```

Résultat attendu:

- `Node runtime smoke: OK`

## 3) Smoke CI (`trigger/finish`)

Créer `ci-smoke.js`:

```js
const seqpulse = require("seqpulse");

const transport = async ({ url, body }) => {
  const payload = JSON.parse(body);
  if (url.endsWith("/deployments/trigger")) {
    return {
      status: 200,
      text: JSON.stringify({
        deployment_id: "00000000-0000-0000-0000-000000000123",
        status: "created",
        echo: payload
      })
    };
  }
  if (url.endsWith("/deployments/finish")) {
    return {
      status: 200,
      text: JSON.stringify({
        status: "accepted",
        echo: payload
      })
    };
  }
  return { status: 404, text: "" };
};

(async () => {
  const client = seqpulse.createCIClient({
    baseUrl: "https://api.seqpulse.dev",
    apiKey: "sp_test",
    metricsEndpoint: "https://app.example.com/seqpulse-metrics",
    nonBlocking: true,
    transport,
  });

  const trigger = await client.trigger({ env: "prod", branch: "main" });
  if (!trigger.ok || !trigger.deploymentId) throw new Error("trigger FAIL");

  const finish = await client.finish({
    deploymentId: trigger.deploymentId,
    result: "success",
  });
  if (!finish.ok || finish.status !== "accepted") throw new Error("finish FAIL");

  console.log("Node CI smoke: OK");
})().catch((e) => {
  console.error("Node CI smoke: FAIL", e);
  process.exit(1);
});
```

Exécuter:

```bash
node ci-smoke.js
```

Résultat attendu:

- `Node CI smoke: OK`

---

## B) Python - Projet vierge

## 1) Setup projet

```bash
mkdir -p /tmp/seqpulse-smoke-py-030
cd /tmp/seqpulse-smoke-py-030
python3 -m venv .venv
source .venv/bin/activate
python -m pip install -U pip
pip install seqpulse==0.3.0 fastapi uvicorn
```

## 2) Smoke runtime (`/seqpulse-metrics`)

Créer `runtime_smoke.py`:

```python
from fastapi import FastAPI
from fastapi.testclient import TestClient
from seqpulse import SeqPulse

app = FastAPI()
sdk = SeqPulse(endpoint="/seqpulse-metrics", hmac_enabled=False)
app.middleware("http")(sdk.middleware())

@app.get("/health")
def health():
    return {"ok": True}

client = TestClient(app)
client.get("/health")
resp = client.get("/seqpulse-metrics")
payload = resp.json()

assert resp.status_code == 200
assert "metrics" in payload
assert isinstance(payload["metrics"]["requests_per_sec"], (int, float))

print("Python runtime smoke: OK")
```

Exécuter:

```bash
python runtime_smoke.py
```

Résultat attendu:

- `Python runtime smoke: OK`

## 3) Smoke CI (`trigger/finish`)

Créer `ci_smoke.py`:

```python
import json
from seqpulse import create_ci_client

def transport(url: str, headers: dict[str, str], body: str, timeout: float):
    payload = json.loads(body)
    if url.endswith("/deployments/trigger"):
        return 200, json.dumps({
            "deployment_id": "00000000-0000-0000-0000-000000000123",
            "status": "created",
            "echo": payload,
        })
    if url.endswith("/deployments/finish"):
        return 200, json.dumps({
            "status": "accepted",
            "echo": payload,
        })
    return 404, ""

client = create_ci_client(
    base_url="https://api.seqpulse.dev",
    api_key="sp_test",
    metrics_endpoint="https://app.example.com/seqpulse-metrics",
    non_blocking=True,
    transport=transport,
)

trigger = client.trigger(env="prod", branch="main")
assert trigger.get("ok") is True
assert trigger.get("deployment_id")

finish = client.finish(deployment_id=trigger["deployment_id"], result="success")
assert finish.get("ok") is True
assert finish.get("status") == "accepted"

print("Python CI smoke: OK")
```

Exécuter:

```bash
python ci_smoke.py
```

Résultat attendu:

- `Python CI smoke: OK`

---

## C) Validation optionnelle contre API reale SeqPulse

Quand les secrets sont disponibles:

```bash
export SEQPULSE_BASE_URL="https://api.seqpulse.dev"
export SEQPULSE_API_KEY="sp_xxx"
export SEQPULSE_METRICS_ENDPOINT="https://your-app.example.com/seqpulse-metrics"
```

Puis utiliser les scripts CI smoke en retirant le `transport` mock pour tester un vrai `trigger/finish`.

---

## Done criteria

La validation post-release est consideree OK si:

1. Node runtime smoke: OK
2. Node CI smoke: OK
3. Python runtime smoke: OK
4. Python CI smoke: OK

