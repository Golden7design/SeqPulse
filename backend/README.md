# SeqPulse Backend

**Post-deployment decision engine for production systems.**

SeqPulse is NOT monitoring, alerting, or observability. It's a **decision API** that analyzes deployment metrics and provides actionable verdicts (ok / attention / rollback_recommended).

---

## Architecture Overview

```
┌─────────────┐
│   CI/CD     │
│  Pipeline   │
└──────┬──────┘
       │
       │ 1. POST /deployments/trigger
       ├────────────────────────────────────►┌──────────────┐
       │                                      │  SeqPulse    │
       │◄────deployment_id──────────────────┤  API         │
       │                                      └──────┬───────┘
       │                                             │
       │                                             │ 2. GET /ds-metrics (PULL)
       │                                             ▼
       │                                      ┌──────────────┐
       │                                      │  Your App    │
       │                                      │  (PRE state) │
       │                                      └──────────────┘
       │
       │ 3. Deploy application
       ├────►  git push / docker push / etc.
       │
       │ 4. POST /deployments/finish
       ├────────────────────────────────────►┌──────────────┐
       │                                      │  SeqPulse    │
       │                                      │  API         │
       │                                      └──────┬───────┘
       │                                             │
       │                                             │ 5. GET /ds-metrics (PULL)
       │                                             ▼
       │                                      ┌──────────────┐
       │                                      │  Your App    │
       │                                      │  (POST state)│
       │                                      └──────────────┘
       │
       │                                      ... wait observation_window ...
       │
       │ 6. GET /deployments/{id}/verdict
       │◄────ok / attention / rollback────────
       │
```

**Key Principle**: SeqPulse **pulls** metrics from your app. Your app does NOT depend on SeqPulse.

---

## What SeqPulse Does

✅ **Compares PRE vs POST metrics**  
✅ **Provides deployment verdict** (ok / attention / rollback_recommended)  
✅ **Stores all metrics** (audit trail, compliance)  
✅ **Analyzes only known metrics** (robustness to schema changes)  
✅ **Configurable thresholds** (per project, per environment)

---

## What SeqPulse Does NOT Do

❌ **Real-time alerting** → Use Prometheus, Datadog, PagerDuty  
❌ **Dashboards** → Use Grafana, Kibana  
❌ **Log aggregation** → Use ELK, Loki  
❌ **APM tracing** → Use Jaeger, Zipkin  
❌ **Auto-rollback** → SeqPulse provides recommendations, YOU decide

---

## Integration Guide

### 1. Expose Metrics Endpoint

Your application must expose a `/ds-metrics` endpoint that returns current metrics:

```python
# Example: FastAPI app
from fastapi import FastAPI, Header, HTTPException
import hmac
import hashlib

app = FastAPI()

@app.get("/ds-metrics")
def metrics(x_seqpulse_signature: str = Header(None)):
    # 1. Verify signature (recommended)
    if not verify_signature(x_seqpulse_signature):
        raise HTTPException(status_code=401)
    
    # 2. Return current metrics
    return {
        "metrics": {
            "latency_p95": get_latency_p95(),
            "error_rate": get_error_rate(),
            "cpu_usage": get_cpu_usage(),
            # ... other metrics
        }
    }
```

**Security Best Practices**:
- ✅ Validate HMAC signature (`X-SeqPulse-Signature`)
- ✅ IP allowlist (configure in reverse proxy)
- ✅ Rate limiting (max 10 req/min recommended)
- ❌ Never expose PII or secrets

See `example_app_integration.py` for complete example.

---

### 2. CI/CD Integration

```yaml
# Example: GitHub Actions
jobs:
  deploy:
    steps:
      # 1. Trigger deployment
      - name: Start SeqPulse tracking
        run: |
          DEPLOYMENT_ID=$(curl -X POST https://api.seqpulse.dev/deployments/trigger \
            -H "X-API-Key: $SEQPULSE_API_KEY" \
            -H "Content-Type: application/json" \
            -d '{
              "env": "prod",
              "metrics_endpoint": "https://api.myapp.com/ds-metrics"
            }' | jq -r '.deployment_id')
          echo "DEPLOYMENT_ID=$DEPLOYMENT_ID" >> $GITHUB_ENV
      
      # 2. Deploy your app
      - name: Deploy
        run: |
          kubectl apply -f k8s/
          kubectl rollout status deployment/myapp
      
      # 3. Finish tracking
      - name: Finish SeqPulse tracking
        run: |
          curl -X POST https://api.seqpulse.dev/deployments/finish \
            -H "X-API-Key: $SEQPULSE_API_KEY" \
            -H "Content-Type: application/json" \
            -d '{
              "deployment_id": "'$DEPLOYMENT_ID'",
              "result": "success",
              "metrics_endpoint": "https://api.myapp.com/ds-metrics",
              "observation_window_minutes": 15
            }'
      
      # 4. Wait and check verdict (optional)
      - name: Wait for analysis
        run: sleep 900  # 15 minutes
      
      - name: Get verdict
        run: |
          VERDICT=$(curl -s https://api.seqpulse.dev/deployments/$DEPLOYMENT_ID/verdict \
            -H "Authorization: Bearer $SEQPULSE_TOKEN" | jq -r '.verdict')
          
          if [ "$VERDICT" = "rollback_recommended" ]; then
            echo "⚠️  Rollback recommended!"
            # Trigger rollback or manual intervention
            exit 1
          fi
```

---

## API Reference

### Authentication

**Machine-to-machine** (CI/CD): `X-API-Key: SP_xxx`  
**Dashboard** (user): `Authorization: Bearer jwt_token`

### Endpoints

#### `POST /deployments/trigger`

Start a deployment cycle.

**Request**:
```json
{
  "env": "prod",
  "metrics_endpoint": "https://api.example.com/ds-metrics"
}
```

**Response**:
```json
{
  "deployment_id": "550e8400-e29b-41d4-a716-446655440000",
  "status": "running",
  "message": "Deployment started. PRE metrics collected."
}
```

**What happens**:
1. Creates deployment record
2. **Pulls PRE metrics** from your app
3. Returns `deployment_id`

---

#### `POST /deployments/finish`

Finish a deployment cycle.

**Request**:
```json
{
  "deployment_id": "550e8400-e29b-41d4-a716-446655440000",
  "result": "success",
  "metrics_endpoint": "https://api.example.com/ds-metrics",
  "observation_window_minutes": 15
}
```

**Response**:
```json
{
  "deployment_id": "550e8400-e29b-41d4-a716-446655440000",
  "status": "success",
  "message": "Analysis scheduled in 15 minutes"
}
```

**What happens**:
1. **Pulls POST metrics** from your app
2. Marks deployment as finished
3. Schedules analysis after observation window

**Important**: `result` is YOUR pipeline status (success/failed), NOT SeqPulse verdict.

---

#### `GET /deployments/{id}/verdict`

Get analysis verdict (after observation window).

**Response**:
```json
{
  "deployment_id": "550e8400-e29b-41d4-a716-446655440000",
  "verdict": "rollback_recommended",
  "confidence": 0.85,
  "summary": "Multiple critical regressions detected",
  "details": [
    "error_rate changed by +120% (baseline: 0.01, current: 0.022)",
    "latency_p95 changed by +45% (baseline: 120.0, current: 174.0)"
  ],
  "created_at": "2026-01-18T12:15:00Z"
}
```

**Verdicts**:
- `ok`: No significant changes detected
- `attention`: Minor degradation, monitor closely
- `rollback_recommended`: Critical issues, consider rollback

---

## Configuration

### Environment Variables

```bash
# Database
DB_HOST=localhost
DB_PORT=5432
DB_NAME=seqpulse
DB_USER=postgres
DB_PASSWORD=***
DATABASE_URL=postgresql://user:pass@host:5432/dbname

# Auth
SECRET_KEY=***  # For JWT signing
JWT_ALGORITHM=HS256
JWT_ACCESS_TOKEN_EXPIRE_MINUTES=43200  # 30 days

# Environment
ENV=production  # or development
```

### Metrics Thresholds (MVP)

Current thresholds are hardcoded in `services/analysis.py`:

```python
DEFAULT_THRESHOLDS = {
    "error_rate": 0.5,          # +50%
    "latency_p95": 0.3,         # +30%
    "latency_p99": 0.4,         # +40%
    "cpu_usage": 0.5,           # +50%
    "memory_usage": 0.7,        # +70%
    "requests_per_sec": -0.4,   # -40% (traffic loss)
    "db_connections": 0.6,      # +60%
}
```

**Roadmap**:
- v2: Configurable per project (UI + DB)
- v3: Adaptive baselines (historical percentiles)

---

## Known Limitations (MVP)

1. **Analysis scheduler**: Uses `threading.Timer` (dev only)  
   → **Production**: Use Celery, RQ, or AWS Lambda

2. **Fixed thresholds**: Not environment-aware  
   → **Future**: Staging vs Prod thresholds

3. **Simple aggregation**: Mean only  
   → **Future**: Percentiles (p95, p99), weighted averages

4. **No baseline history**: Compares only PRE vs POST  
   → **Future**: Compare vs last N deployments

5. **No metric correlation**: Each metric analyzed independently  
   → **Future**: Detect correlated anomalies (CPU + latency)

---

## Development

### Setup

```bash
# 1. Create venv
python -m venv .venv
source .venv/bin/activate  # Windows: .venv\Scripts\activate

# 2. Install dependencies
pip install -r requirements.txt

# 3. Configure .env
cp .env.example .env
# Edit .env with your values

# 4. Run migrations
cp alembic.ini.example alembic.ini
# Edit alembic.ini with your DATABASE_URL
alembic upgrade head

# 5. Start server
uvicorn app.main:app --reload --port 8000
```

### Database Migrations

```bash
# Create new migration
alembic revision --autogenerate -m "description"

# Apply migrations
alembic upgrade head

# Rollback
alembic downgrade -1
```

### Testing

```bash
# Run tests
pytest

# With coverage
pytest --cov=app --cov-report=html
```

---

## Architecture Decisions

### Why PULL instead of PUSH?

**Anti-pattern** (current industry trend):
```
App → POST /metrics → SeqPulse
```

**Problems**:
- App depends on SeqPulse (coupling)
- Network failures break app
- Firewall/zero-trust issues

**Our approach**:
```
SeqPulse → GET /ds-metrics → App
```

**Benefits**:
- App is independent
- SeqPulse handles retries
- Simpler security model

### Why store ALL metrics?

Even though we only analyze known metrics, we store everything for:

1. **Auditability**: Compliance, post-mortem analysis
2. **Learning**: Discover new important metrics
3. **Future-proofing**: Reanalyze past data with new algorithms

### Why separate `result` and `verdict`?

- `result` = **What happened** (pipeline success/failed)
- `verdict` = **What to do** (SeqPulse recommendation)

Example:
```
Pipeline result: success
SeqPulse verdict: rollback_recommended
```

This decoupling allows CI/CD to succeed while still flagging issues.

---

## Production Checklist

Before deploying to production:

- [ ] Configure HTTPS + TLS 1.3
- [ ] Set strong `SECRET_KEY` (32+ chars, random)
- [ ] Enable database connection pooling
- [ ] Set up database backups (daily)
- [ ] Configure metrics retention policy (7d free, 30d pro)
- [ ] Set up proper logging (JSON, structured)
- [ ] Configure CORS whitelist
- [ ] Enable rate limiting (reverse proxy)
- [ ] Set up monitoring (Prometheus, Datadog)
- [ ] Configure alerting (PagerDuty, Opsgenie)
- [ ] Document runbooks (rollback, incident response)

---

## Support

- **Documentation**: https://docs.seqpulse.dev
- **Issues**: https://github.com/seqpulse/backend/issues
- **Email**: support@seqpulse.dev

---

## License

Proprietary - All rights reserved