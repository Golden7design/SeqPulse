# SeqPulse - Priorités d'Architecture

**Date de création:** 2026-02-06
**Auteur:** Satoru (IA Senior Architect)
**Projet:** SeqPulse - Monitoring intelligent de déploiement

---

## 🚨 CRITICAL (Bloqueurs) - À corriger IMMÉDIATEMENT

### 1. Scheduler: Zero Persistence
**Problème:** Le scheduler actuel utilise `threading.Thread` et `threading.Timer` — si le backend crash (OOM, restart, deploy), TOUS les scheduled jobs sont perdus.

**Impact:**
- Déploiements sans analyse si le backend redémarre
- Pas de mécanisme de recovery automatique
- Impossible de monitorer l'état des tâches

**Solution Recommandée:** Custom Job Table + Poller (MVP)
- Créer table `scheduled_jobs` avec colonnes: id, deployment_id, job_type, phase, scheduled_at, status (pending/running/completed/failed), retry_count, last_error
- Background poller (cron every 10s) qui:
  1. Sélectionne les jobs `pending` avec `scheduled_at <= now()`
  2. Marque comme `running`
  3. Exécute la tâche
  4. Met à jour le statut (completed/failed) avec retry logic
- Avantages: Persistant, inspectable en DB, simple à implémenter, pas de Redis/Celere

**Alternative Future:** Celere + Redis (production-grade) si tu scales

---

### 2. Race Condition dans `analyze_deployment`
**Problème:** Pas de lock row-level sur le deployment avant analyse. Deux appels concurrents peuvent créer deux verdicts, dupliquer les SDH hints.

**Impact:**
- Données dupliquées en DB
- Incohérence dans les résultats UI
- Problèmes de confiance dans les verdicts

**Solution:** Deux approches possibles:

**Option 1: Idempotent INSERT (recommandé)**
```sql
INSERT INTO deployment_verdicts (deployment_id, verdict, ...)
VALUES (...)
ON CONFLICT (deployment_id) DO NOTHING;
```

**Option 2: Row-level Lock**
```python
deployment = db.query(Deployment).filter_by(id=deployment_id).with_for_update().one()
# ... analyse
```

---

### 3. Error Handling & Retries Absolants
**Problème:** Si `/ds-metrics` renvoie 503/timeout, la collecte échoue sans retry. Les partial failures ne sont pas gérées.

**Impact:**
- Analyses incomplètes (samples manquants)
- Verdicts peu fiables
- Pas de recovery automatique

**Solution:** Retry logic avec exponential backoff
```python
MAX_RETRIES = 3
RETRY_DELAYS = [5, 15, 30]  # seconds

for attempt, delay in enumerate(RETRY_DELAYS + [None]):
    try:
        collect_metrics(...)
        return
    except (httpx.RequestError, ValueError) as e:
        if delay is None:
            raise
        time.sleep(delay)
```

---

### 4. Blocking Threads dans `schedule_post_collection`
**Problème:** Chaque déploiement bloque un thread pendant `observation_window × 60s`. 20 déploiements concurrents = 20 threads bloqués.

**Impact:**
- Scalabilité limitée
- Performance dégradée sous load
- Possibilité de deadlock si trop de threads en attente

**Solution:** Split en tasks individualuelles
```python
# Au lieu d'une boucle bloquante, lance N tasks individuelles
for i in range(observation_window):
    schedule_post_collect_single(
        deployment_id=deployment_id,
        sequence_index=i,
        delay_seconds=i * 60,  # 0s, 60s, 120s...
        metrics_endpoint=...
    )
```

---

## ⚠️ HIGH (Importants) - À corriger sous 2-4 semaines

### 5. Missing Idempotency dans plusieurs endpoints
**Problème:** Plusieurs API endpoints ne sont pas idempotents. Un double appel créerait des duplicates.

**Impact:** Données corrompues par des retries accidentels

**Solution:** Utiliser `ON CONFLICT DO NOTHING` ou locks row-level pour toutes les opérations de création.

---

### 6. No Structured Logging
**Problème:** Les logs utilisent `print()` et `logger.warning()` sans structure cohérente.

**Impact:**
- Impossible de tracer un deployment end-to-end
- Difficile de debuguer en production
- Pas de logs JSON pour ingestion dans ELK/Graylog

**Solution:** Intégrer `structlog` ou `python-json-logger`
```python
logger.info(
    "metrics_collected",
    deployment_id=str(deployment_id),
    phase=phase,
    latency_avg=post_agg["latency_p95"],
    duration_ms=duration
)
```

---

### 7. No Healthcheck Monitoring
**Problème:** Le `/health` endpoint existe mais ne vérifie pas:
- Que le scheduler poller est actif
- Que la DB connecte correctement
- Que les tasks ne sont pas stuck en state `pending`

**Impact:** Impossible de savoir si le système est healthy en production

**Solution:** Healthcheck enrichi
```python
@app.get("/health")
def health(db: Session = Depends(get_db)):
    checks = {
        "db": db_check(db),
        "scheduler_last_heartbeat": get_scheduler_last_heartbeat(),
        "pending_jobs_count": get_pending_jobs_count(),
    }
    all_healthy = all(checks.values())
    return {"status": "ok" if all_healthy else "degraded", "checks": checks}
```

---

### 8. Missing Metrics (Prometheus/StatsD)
**Problème:** Aucune métrique exposée pour monitorer SeqPulse lui-même.

**Impact:** Impossible de créer des dashboards Grafana, d'alerter sur anomalies

**Solution:** Intégrer `prometheus_client`
```python
from prometheus_client import Counter, Histogram

metrics_collected_total = Counter('seqpulse_metrics_collected_total', 'Total metrics collected')
analysis_duration = Histogram('seqpulse_analysis_duration_seconds', 'Analysis duration')
```

---

## 🔍 MEDIUM (Améliorations) - À corriger sur la roadmap

### 9. Coverage de Tests Incomplète
**Problème:** Tests existent mais couverture insuffisante, spécialement pour:
- SDH logic (règles de diagnostics complexes)
- Scheduler edge cases (concurrent analyses)
- HMAC security (replay attacks, TTL skew)

**Impact:** Refactors risqués, bugs possibles

**Solution:** Prioriser SDH tests en premier (core de la valeur ajoutée)

---

### 10. No Metrics Archiving Strategy
**Problème:** `metric_samples` va grossir indéfiniment. Pas de stratégie de purging/archivage.

**Impact:** DB performance dégrade avec le temps, storage cost explose

**Solution:**
- Court terme: Cron job qui supprime les samples > 30 jours
- Long terme: Migrate vers TimescaleDB/ClickHouse pour time-series optimization

---

### 11. Frontend Dashboard Incomplet
**Problème:** Frontend a structure mais pas toutes les pages implémentées.

**Impact:** Expérience utilisateur incomplète

**Solution:** Priorité:
1. Dashboard principal (overview)
2. Deployment detail (timeline, charts, SDH)
3. SDH page (filter by severity)
4. Projects management

---

### 12. No Rate Limiting sur `/ds-metrics`
**Problème:** Si un projet abuse de l'endpoint de metrics, il peut DDoS le backend.

**Impact:** Instabilité potentielle sous abuse

**Solution:** Intégrer `slowapi` ou `fastapi-limiter`
```python
@app.get("/ds-metrics")
@limiter.limit("10/minute")
def get_metrics(...):
```

---

## ✅ POINTS FORTS À CONSERVER

### Excellences Architecturelles
1. **SDH Intelligent:** Diagnostics multi-metrics composites — c'est ta valeur ajoutée unique
2. **HMAC Security:** Implementation robuste avec canonicalization, nonce, TTL
3. **Database Models:** Relations SQLAlchemy propres, CASCADE delete correct, index bien placés
4. **Separation of Concerns:** Modules bien isolés (scheduler, collector, analysis, SDH)
5. **Configuration Dynamique:** Plans Free/Pro avec observation_windows variables

---

## 📋 PLAN D'ACTION RECOMMANDÉ

### Week 1-2: Critical Fixes
- [ ] Refactor scheduler → Custom Job Table + Poller
- [ ] Fix race conditions dans `analyze_deployment`
- [ ] Add retry logic pour metric collections
- [ ] Unbloquer threads dans post collection (split tasks)

### Week 3-4: High Priority
- [ ] Structured logging (structlog)
- [ ] Healthcheck enrichi (scheduler monitoring)
- [ ] Basic metrics exposure (prometheus_client)
- [ ] Idempotency sur tous les endpoints

### Week 5-8: Medium Priority
- [ ] Compléter frontend dashboard
- [ ] SDH tests (priorité absolue)
- [ ] Metrics archiving strategy
- [ ] Rate limiting sur `/ds-metrics`

---

## 🎯 MESURES DE SUCCÈS

### Avant Fix Critiques
- Scheduler: **0% persistence** (jobs perdus si crash)
- Race conditions: **non protégé**
- Retries: **absent**
- Thread blocking: **scalabilité limitée**

### Après Fixes Critiques
- Scheduler: **100% persistence** (jobs en DB, recovery auto)
- Race conditions: **0 chance** (ON CONFLICT locks)
- Retries: **3 attempts** avec exponential backoff
- Thread blocking: **0 blocking** (tasks async)

---

## 📊 METRICS TARGETS

- **Scheduler Uptime:** > 99.9%
- **Metric Collection Success Rate:** > 95% (avec retries)
- **Analysis Latency:** < 2s après collection POST
- **DB Connection Pool:** < 50% usage normal
- **Queue Depth:** < 10 pending jobs normal

---

## 🚀 PROCHAINES ÉTAPES

1. **Commençons par le scheduler refactor** — c'est le fondement d'un système production-ready
2. **Tester à fond** chaque fix avec load tests
3. **Mettre en prod** les fixes critiques avant d'ajouter des features
4. **Monitorer** avec les nouvelles metrics exposées

Tu veux que je te guide sur l'une de ces priorités en particulier ? Le scheduler refactor est le meilleur point de départ pour stabiliser le système. 🎯