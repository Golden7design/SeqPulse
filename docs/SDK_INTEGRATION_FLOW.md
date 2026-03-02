# SDK Integration Flow (Source of Truth) - v0.2.0

## Objectif

Definir un flow d'integration clair dans l'onglet `integration` de `project/[projectName]`:

- integration applicative SDK (metrics + HMAC)
- integration pipeline CI/CD (trigger/finish)

## Separation des responsabilites

### SDK (runtime application)

Le SDK couvre:

- instrumentation HTTP metrics
- endpoint metrics
- validation HMAC v2 optionnelle

Le SDK ne couvre pas:

- orchestration du pipeline deploy
- appels `trigger/finish`

### CI/CD

Le pipeline couvre:

- appel PRE: `/deployments/trigger`
- appel POST: `/deployments/finish`
- transmission de `metrics_endpoint`

## Variables d'environnement (obligatoire)

### Secrets CI/CD platform

```bash
SEQPULSE_API_KEY=sp_xxx
SEQPULSE_BASE_URL=https://api.seqpulse.io
SEQPULSE_METRICS_ENDPOINT=https://your-app.example.com/seqpulse-metrics
```

### Variables runtime application

```bash
SEQPULSE_HMAC_ENABLE=true
SEQPULSE_HMAC_SECRET=hmac_xxx
```

## Regles snippets UI

1. Toujours pre-remplir `SEQPULSE_METRICS_ENDPOINT` avec l'endpoint projet:
   - priorite: `active_endpoint`
   - fallback: `candidate_endpoint`
2. Si le SDK attend un path, extraire le path depuis l'URL (`/ds-metrics`, etc.).
3. SDK `v0.2.0`:
   - `apiKey` / `api_key` optionnel
   - ne pas imposer de variable API key runtime dans snippets SDK
4. Afficher l'etat endpoint (`pending_verification`, `active`, `blocked`).
5. Si endpoint non actif, afficher `Run Test & Activate`.

## UX cible (onglet integration)

1. Step 1: Install SDK
2. Step 2: Variables d'environnement (2 blocs: CI/CD + runtime)
3. Step 3: Snippet Node/Python SDK
4. Step 4: Snippet CI/CD pipeline (trigger/finish)

## Criteres d'acceptation

1. Le dev peut copier-coller un setup SDK sans ajouter `SEQPULSE_API_KEY` runtime.
2. Les secrets pipeline sont explicites et separes des variables runtime.
3. Le flow endpoint lock/test existant reste intact.
4. Le message produit est coherent avec SDK `v0.2.0`.
