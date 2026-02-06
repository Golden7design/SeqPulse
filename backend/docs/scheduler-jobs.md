# SEQPULSE — Système de Jobs (Scheduler Persistant)

Ce document décrit **le système de jobs de SeqPulse** tel qu’il est implémenté aujourd’hui.  
Objectif : comprendre le flux complet, les états, la résilience, et comment monitorer.

---

**1) Pourquoi ce système existe**
- Avant, des timers en mémoire lançaient les tâches. En cas de crash ou de redéploiement, tout était perdu.
- Maintenant, chaque tâche est stockée **en base**, et un poller les exécute au bon moment.
- Résultat : **aucune tâche n’est perdue** si le backend redémarre.

---

**2) Les acteurs (fichiers clés)**
- Modèle DB : `app/db/models/scheduled_job.py`
- Migrations :  
  `migrations/versions/add_scheduled_jobs_table.py`  
  `migrations/versions/add_job_metadata_to_scheduled_jobs.py`
- Création des jobs : `app/scheduler/tasks.py`
- Exécution des jobs (poller) : `app/scheduler/poller.py`
- Début/fin de déploiement : `app/deployments/services.py`
- Config plan (window/delay) : `app/scheduler/config.py`
- Collecte métriques : `app/metrics/collector.py`
- Analyse + verdict + SDH :  
  `app/analysis/engine.py`  
  `app/analysis/sdh.py`
- Monitoring : `app/main.py` (`/health/scheduler`)

---

**3) Schéma des jobs**
Table `scheduled_jobs` (principales colonnes) :
- `id` (UUID)
- `deployment_id`
- `job_type` : `pre_collect`, `post_collect`, `analysis`
- `phase` : `pre`, `post`, ou `null`
- `sequence_index` : index des collectes post (0,1,2…)
- `scheduled_at` : date d’exécution
- `status` : `pending`, `running`, `completed`, `failed`
- `retry_count`
- `last_error`
- `job_metadata` (JSONB) : params nécessaires (endpoint, hmac, project_id)
- `created_at`, `updated_at`

---

**4) Flux complet**

**4.1 /deployments/trigger**
- Crée un `Deployment` en DB avec `state="running"`.
- Si `metrics_endpoint` est fourni, crée **un job `pre_collect` immédiat**.
- Le poller l’exécute et collecte les métriques PRE.

**4.2 /deployments/finish**
- Met `state="finished"` + `finished_at` + `duration_ms`.
- Calcule :
  - `window` (nb de collectes POST)
  - `delay` (minutes avant analyse)
- Crée :
  - **N jobs `post_collect`** (0s, 60s, 120s, …)
  - **1 job `analysis`** (après `delay` minutes)

**4.3 Poller**
Toutes les 10s, il :
- prend les jobs `pending` dont `scheduled_at <= now`
- passe le job en `running`
- exécute :
  - `pre_collect` / `post_collect` → `collect_metrics`
  - `analysis` → `analyze_deployment`
- marque `completed` ou `failed`

---

**5) Résilience**

**5.1 Crash du backend**
- Les jobs restent en DB.
- À la reprise, le poller exécute les jobs “en retard”.

**5.2 Recovery des jobs bloqués**
Si un job reste `running` trop longtemps :
- il repasse en `pending` (et repart)
- ou passe en `failed` si le max de retries est dépassé

Constantes actuelles :
- `RUNNING_STUCK_SECONDS = 10 minutes`
- `MAX_RETRIES = 3`

**5.3 Retry policy**
En cas d’erreur collect/analyse :
- le job est reprogrammé (`pending`) avec un délai croissant
- backoff : `30s`, `120s`, `300s`
- au‑delà, le job passe en `failed`

---

**6) Monitoring**

Endpoint :
- `GET /health/scheduler`

Exemple de réponse :
```json
{
  "poller_running": true,
  "pending": 2,
  "running": 1,
  "failed": 0,
  "stuck_running": 0
}
```

À utiliser pour :
- dashboard simple
- alerting si `failed > 0` ou `stuck_running > 0`

---

**7) Vérification rapide en DB**

Jobs d’un déploiement :
```sql
select job_type, status, scheduled_at, sequence_index
from scheduled_jobs
where deployment_id = '<DEPLOYMENT_ID>'
order by scheduled_at;
```

Samples collectés :
```sql
select phase, count(*)
from metric_samples
where deployment_id = '<DEPLOYMENT_ID>'
group by phase;
```

Verdict et SDH :
```sql
select * from deployment_verdicts where deployment_id = '<DEPLOYMENT_ID>';
select * from sdh_hints where deployment_id = '<DEPLOYMENT_ID>';
```

---

**8) Statuts attendus**
- Après `trigger` : 1 job `pre_collect`
- Après `finish` : N jobs `post_collect` + 1 job `analysis`
- Tous les jobs passent `pending → running → completed` (ou `failed`)
- Si `pre` + `post` sont présents, l’analyse génère un verdict + SDH

---

**9) Limites connues (hors MVP)**
- Scaling horizontal : un seul poller peut suffire, plusieurs pollers nécessitent une stratégie de “claim” plus robuste.
- Métriques/alerting avancé : possible via Prometheus, non inclus par défaut.

---

**Résumé**
Le scheduler SeqPulse est **persistant, résilient, observable**, et supporte les redémarrages sans perdre les tâches.  
Ce système est prêt pour la production, avec un comportement clair et vérifiable en DB et via `/health/scheduler`.
