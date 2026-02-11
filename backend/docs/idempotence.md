# Idempotence - SeqPulse API

**Date:** 2026-02-10  
**Version:** 2.0  
**Status:** ✅ Implémenté

---

## 📋 Vue d'Ensemble

SeqPulse implémente une idempotence **simple, robuste et CI/CD‑agnostique**.

Objectifs :
- ✅ empêcher les retries malveillants
- ✅ éviter les doublons
- ✅ garantir un seul déploiement actif
- ✅ rester compatible avec tous les CI/CD

---

## 🧠 Règles Métier (Fondation)

Pour un `(project_id, env)` :

- **Un seul deployment RUNNING** à la fois
- Le lifecycle est strict :

```
pending → running → finished → analyzed
```

- `/finish` ne s'applique qu'à un `running`
- Les métriques sont rattachées à **un seul** deployment

---

## 🔑 Clé d'Idempotence: Idempotency-Key

SeqPulse utilise une **clé opaque** fournie par le pipeline.

- ✅ Pas de parsing
- ✅ Pas de dépendance GitHub/GitLab/Jenkins
- ✅ Juste : **si déjà vue → même résultat**

Supportée via :
- Header: `X-Idempotency-Key`
- Body: `idempotency_key`

---

## 🗄️ Contraintes Base de Données

### ✅ Un seul deployment running par projet/env

```sql
CREATE UNIQUE INDEX uq_running_deployment
ON deployments(project_id, env)
WHERE state = 'running';
```

### ✅ Empêcher doublons de métriques

```sql
CREATE UNIQUE INDEX uq_metric_sample
ON metric_samples(deployment_id, phase, collected_at);
```

### ✅ Idempotency-Key unique (optionnel)

```sql
CREATE UNIQUE INDEX uq_idempotency_key
ON deployments(idempotency_key)
WHERE idempotency_key IS NOT NULL;
```

---

## 🚀 Logique `/deployments/trigger`

But: créer ou récupérer un deployment `running`.

```python
def trigger(project_id, env, idempotency_key=None):
    # 1. Si idempotency key existe déjà → retourner le deployment existant
    if idempotency_key:
        existing = db.query(Deployment).filter_by(
            idempotency_key=idempotency_key
        ).first()
        if existing:
            return existing

    # 2. Si un running existe déjà → retourner le running
    running = db.query(Deployment).filter_by(
        project_id=project_id,
        env=env,
        state="running"
    ).first()
    if running:
        return running

    # 3. Créer un nouveau deployment
    dep = Deployment(
        project_id=project_id,
        env=env,
        state="running",
        idempotency_key=idempotency_key,
    )
    db.add(dep)

    try:
        db.commit()
    except IntegrityError:
        # Race condition → quelqu'un a créé un running juste avant
        db.rollback()
        return db.query(Deployment).filter_by(
            project_id=project_id,
            env=env,
            state="running"
        ).first()

    return dep
```

Résultat :
- ✅ retry = même deployment
- ✅ spam = même deployment
- ✅ crash réseau = OK
- ✅ pas de doublon

---

## 🏁 Logique `/deployments/finish`

But: terminer **un seul** deployment.

```python
def finish(deployment_id, result):
    dep = db.query(Deployment).get(deployment_id)

    if not dep:
        return {"status": "not_found"}

    # Déjà terminé ? → no-op
    if dep.state != "running":
        return {"status": "ignored"}

    dep.pipeline_result = result
    dep.state = "finished"
    dep.finished_at = now()
    dep.duration_ms = ...

    db.commit()
    enqueue_analysis_job(dep.id)

    return {"status": "accepted"}
```

Résultat :
- ✅ retry = ignoré
- ✅ spam = ignoré
- ✅ pas de double finish
- ✅ pas d'état incohérent

Réponses possibles :
- `accepted` → transition vers `finished`
- `ignored` → déjà terminé (idempotent)
- `not_found` → deployment inconnu

---

## 📊 Logique `/metrics`

```python
def collect_metrics(deployment_id, phase, metrics):
    sample = MetricSample(
        deployment_id=deployment_id,
        phase=phase,
        collected_at=now(),
        **metrics
    )

    db.add(sample)

    try:
        db.commit()
    except IntegrityError:
        # doublon → ignore
        db.rollback()

    return {"status": "ok"}
```

Résultat :
- ✅ pas de doublon
- ✅ pas d'écrasement
- ✅ retry safe

---

## 🔧 Utilisation dans les CI/CD (universel)

L'idée: définir **une seule variable** `SEQPULSE_IDEMPOTENCY_KEY` de façon uniforme.

```bash
SEQPULSE_IDEMPOTENCY_KEY="${SEQPULSE_IDEMPOTENCY_KEY:-${GITHUB_RUN_ID:-${CI_PIPELINE_ID:-${CI_JOB_ID:-${BUILD_ID:-${BUILD_TAG:-${BUILD_NUMBER:-${RUN_ID:-}}}}}}}}"

if [ -z "$SEQPULSE_IDEMPOTENCY_KEY" ]; then
  echo "SeqPulse: idempotency key manquante. Définis SEQPULSE_IDEMPOTENCY_KEY."
  exit 1
fi

curl -X POST https://api.seqpulse.dev/deployments/trigger \
  -H "X-API-Key: $SEQPULSE_API_KEY" \
  -H "Content-Type: application/json" \
  -H "X-Idempotency-Key: $SEQPULSE_IDEMPOTENCY_KEY" \
  -d '{
    "env": "production",
    "branch": "main",
    "metrics_endpoint": "https://myapp.com/metrics"
  }'
```

---

## 🛡️ Protection Contre “Le Malin”

Même sans Idempotency‑Key :

| Attaque       | Résultat                 |
| ------------- | ------------------------ |
| spam /trigger | retourne le même running |
| spam /finish  | ignoré                   |
| spam /metrics | rejet DB                 |
| flood         | rate limit               |
| spoof         | API key + HMAC           |

---

## 🧩 Invariants (non négociables)

❌ 2 deployments running pour le même projet/env  
❌ un deployment finished sans running  
❌ metrics sans deployment  
❌ verdict sans metrics  
❌ duplication DB

Si ces invariants tiennent → système sain.

---

## ✅ Résumé

SeqPulse garantit :
- retries sûrs
- crash safe
- anti‑spam
- CI/CD compatible
- prêt pour scale
