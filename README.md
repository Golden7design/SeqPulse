![Logo de SeqPulse](./png.png)

# SeqPulse

SeqPulse est une plateforme de suivi post-deploiement pour equipes produit/infra:
- collecte des signaux de deploiement depuis vos pipelines CI/CD,
- analyse des metriques pre/post,
- emission de verdicts (`ok`, `warning`, `rollback_recommended`),
- exposition de hints SDH (Seqpulse Debug Hints),
- dashboard web pour supervision rapide,
- auth locale + OAuth (GitHub/Google) + 2FA TOTP.

## Stack

- Backend: FastAPI, SQLAlchemy, Alembic, SlowAPI, Prometheus client
- Frontend: Next.js (App Router), React, TypeScript, Tailwind, next-intl
- Base de donnees: PostgreSQL

## Structure du repo

```text
SEQPULSE/
├── backend/    # API FastAPI, migrations, tests, observability
├── frontend/   # Dashboard Next.js
└── docs/       # Notes produit, auth, 2FA, integration
```

## Prerequis

- Python 3.10+
- Node.js 20+
- pnpm
- PostgreSQL 14+ (ou compatible)

## Quickstart local

### 1) Backend

Depuis `backend/`:

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

Creer `backend/.env` (ne jamais commiter de secrets):

```dotenv
ENV=development

DB_HOST=localhost
DB_PORT=5432
DB_NAME=database_name
DB_USER=postgres
DB_PASSWORD=postgres
DATABASE_URL=postgresql+psycopg2://postgres:postgres@localhost:5432/database_name

SECRET_KEY=change_me_with_a_long_random_secret
JWT_ALGORITHM=HS256
JWT_ACCESS_TOKEN_EXPIRE_MINUTES=1440
FRONTEND_URL=http://localhost:3000
EMAIL_PROVIDER=resend
EMAIL_API_KEY=
EMAIL_FROM=noreply@seqpulse.dev
EMAIL_REPLY_TO=support@seqpulse.dev
EMAIL_CTA_DASHBOARD_PATH=/dashboard
EMAIL_CTA_PRICING_PATH=/pricing
EMAIL_CTA_ONBOARDING_PATH=/projects/new
EMAIL_MARKETING_COOLDOWN_HOURS=24
EMAIL_ENABLED_TYPES=
# Local/dev sans provider externe:
# EMAIL_PROVIDER=console
# Rollout progressif (exemple):
# EMAIL_ENABLED_TYPES=E-TRX-01,E-ACT-01,E-ACT-04

GITHUB_CLIENT_ID=
GITHUB_CLIENT_SECRET=
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=

AUTH_COOKIE_NAME=seqpulse_session
AUTH_PREAUTH_COOKIE_NAME=seqpulse_2fa_preauth
AUTH_COOKIE_SAMESITE=lax
AUTH_COOKIE_SECURE=false

TWOFA_ISSUER=SEQPULSE
TWOFA_ENCRYPTION_KEY=replace_with_fernet_key
TWOFA_CODE_DIGITS=6
TWOFA_PERIOD_SECONDS=30
TWOFA_VALID_WINDOW=1
TWOFA_RECOVERY_CODES_COUNT=10
TWOFA_CHALLENGE_TTL_SECONDS=300
TWOFA_CHALLENGE_MAX_ATTEMPTS=5
TWOFA_PREAUTH_TTL_SECONDS=300
```

Generer une cle Fernet pour `TWOFA_ENCRYPTION_KEY`:

```bash
python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
```

Appliquer les migrations puis lancer l'API:

```bash
alembic upgrade head
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

### 2) Frontend

Depuis `frontend/`:

```bash
pnpm install
```

Creer `frontend/.env.local`:

```dotenv
NEXT_PUBLIC_BACKEND_URL=http://localhost:8000
```

Lancer le frontend:

```bash
pnpm dev
```

### 3) Acces local

- Frontend: `http://localhost:3000`
- Backend API: `http://localhost:8000`
- OpenAPI (Swagger): `http://localhost:8000/docs`
- Health API: `http://localhost:8000/health`
- Metrics Prometheus: `http://localhost:8000/metrics`
- KPI lifecycle (JSON): `http://localhost:8000/analytics/kpi/lifecycle?window_days=7`

## Commandes utiles

### Backend

```bash
cd backend
source .venv/bin/activate
pytest -q
```

### Frontend

```bash
cd frontend
pnpm lint
pnpm build
```

## Fonctionnalites principales

- Auth complete:
  - signup/login classique,
  - OAuth GitHub et Google,
  - session cookie + token pour client,
  - 2FA TOTP avec recovery codes.
- Projets:
  - creation et listing,
  - gestion HMAC (enable, disable, rotate).
- Deployments:
  - endpoints CI/CD (`/deployments/trigger`, `/deployments/finish`),
  - listing, detail, metriques associees.
- SDH:
  - hints de degradation avec severite et signaux composites.
- Observability:
  - endpoint `/metrics`,
  - checks `/health` et `/health/scheduler`.

## Internationalisation frontend

Les traductions sont dans `frontend/locales/`:
- `en.json`
- `fr.json`
- `es.json`
- `de.json`

## Monitoring (optionnel)

Un stack Prometheus/Grafana local est disponible:

```bash
cd backend/observability/prometheus
docker compose up -d
```

Documentation: `backend/docs/prometheus-grafana-onboarding.md`

## Securite

- Note de reference 2FA: `docs/2FA_SECURITY_NOTES.md`
- En local, le rate limit SlowAPI utilise `memory://` (process-local).
- En production, utiliser un backend partage (ex: Redis) pour le rate limiting.
- Toujours tourner les secrets OAuth/JWT et ne pas commiter de `.env`.

## Troubleshooting rapide

- Erreurs CORS/cookies en local:
  - eviter de melanger `localhost` et `127.0.0.1` entre frontend/backend.
- Erreur DB au demarrage:
  - verifier `DATABASE_URL`,
  - verifier PostgreSQL actif,
  - relancer `alembic upgrade head`.
- OAuth indisponible:
  - verifier `GITHUB_*` / `GOOGLE_*` dans `backend/.env`.
- Emails lifecycle MVP non envoyes:
  - verifier `EMAIL_PROVIDER`, `EMAIL_API_KEY`, `EMAIL_FROM`,
  - verifier les CTA (`EMAIL_CTA_*`) et `FRONTEND_URL`.
  - verifier `EMAIL_ENABLED_TYPES`:
    - vide = tous les types actifs
    - non vide = seuls les types listes sont envoyes

## Documentation additionnelle

- `docs/AUTH_COOKIE_HARDENING.md`
- `docs/OAUTH_GITHUB_SEQPULSE.md`
- `docs/2FA_IMPLEMENTATION_TASKS.md`
- `docs/2FA_SECURITY_NOTES.md`
