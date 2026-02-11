# Idempotence Implementation - SeqPulse

**Date:** 2026-02-10  
**Priorité:** #5 (HIGH)  
**Status:** ✅ IMPLÉMENTÉ

---

## 📋 Résumé

Implémentation d'une idempotence **CI/CD‑agnostique** basée sur une **Idempotency‑Key opaque** et une contrainte **"un seul running"** par `(project_id, env)`.

**Principe:** 1 exécution de pipeline = 1 déploiement (si une clé est fournie)

---

## 🎯 Objectifs Atteints

- ✅ Retries sûrs (idempotency key)
- ✅ Anti‑doublons (DB + logique applicative)
- ✅ Un seul deployment running par env
- ✅ Compatible tous CI/CD (pas de dépendance fournisseur)
- ✅ Métriques idempotentes

---

## 📦 Fichiers Créés / Modifiés

### 1. `migrations/versions/idempotency_key_002.py`
Migration Alembic qui :
- Supprime `commit_sha` et l'unicité `(project_id, env, commit_sha)`
- Ajoute `idempotency_key`
- Crée l'index unique partiel `uq_running_deployment`
- Crée l'index unique partiel `uq_deployments_idempotency_key`
- Crée l'index unique `uq_metric_sample`

### 2. `app/db/models/deployment.py`
```python
idempotency_key = Column(String(255), nullable=True)

Index(
    "uq_running_deployment",
    "project_id",
    "env",
    unique=True,
    postgresql_where=text("state = 'running'"),
)

Index(
    "uq_deployments_idempotency_key",
    "idempotency_key",
    unique=True,
    postgresql_where=text("idempotency_key IS NOT NULL"),
)
```

### 3. `app/db/models/metric_sample.py`
```python
Index(
    "uq_metric_sample",
    "deployment_id",
    "phase",
    "collected_at",
    unique=True,
)
```

### 4. `app/deployments/schemas.py`
```python
class DeploymentTriggerRequest(BaseModel):
    env: str
    idempotency_key: Optional[str]
    branch: Optional[str]
    metrics_endpoint: HttpUrl
```

### 5. `app/deployments/services.py`
```python
# 1) Idempotency-Key → retourner l'existant
# 2) Running existant → retourner le running
# 3) Créer nouveau deployment
# 4) IntegrityError → retourner running ou clé existante
```

### 6. `app/metrics/collector.py`
```python
try:
    db.commit()
except IntegrityError:
    # doublon → ignore
    db.rollback()
```

---

## 🔧 Stratégie d'Implémentation

### Double Protection

1. **Logique Applicative**
   - Check idempotency_key
   - Check running

2. **Contraintes DB**
   - `uq_running_deployment` (race‑condition safe)
   - `uq_deployments_idempotency_key` (idempotence)
   - `uq_metric_sample` (metrics)

---

## 🧪 Installation & Tests

### 1. Exécuter la Migration

```bash
cd SEQPULSE/backend
alembic upgrade head

# Vérifier les indexes
psql -d seqpulse -c "\d deployments"
psql -d seqpulse -c "\d metric_samples"
```

### 2. Tester Manuellement

```bash
curl -X POST http://localhost:8000/deployments/trigger \
  -H "X-API-Key: YOUR_API_KEY" \
  -H "X-Idempotency-Key: run-123" \
  -H "Content-Type: application/json" \
  -d '{
    "env": "production",
    "branch": "main",
    "metrics_endpoint": "https://example.com/metrics"
  }'

# Retry (même Idempotency-Key) → même deployment_id
```

### 3. Tests Automatisés

```bash
python test_idempotence.py
```

---

## 🔍 Debugging

```sql
-- Running actif par env (ne doit jamais être > 1)
SELECT project_id, env, COUNT(*)
FROM deployments
WHERE state = 'running'
GROUP BY project_id, env
HAVING COUNT(*) > 1;

-- Doublons métriques (ne doit rien retourner)
SELECT deployment_id, phase, collected_at, COUNT(*)
FROM metric_samples
GROUP BY deployment_id, phase, collected_at
HAVING COUNT(*) > 1;
```

---

## 📚 Références

- [docs/idempotence.md](docs/idempotence.md)
- [test_idempotence.py](test_idempotence.py)
