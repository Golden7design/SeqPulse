# SeqPulse - Flux Complet d'Analyse

## 1) Vue d'ensemble
Le flux d'analyse SeqPulse transforme des métriques `pre/post` d'un déploiement en:
- un verdict (`ok`, `warning`, `rollback_recommended`),
- des hints SDH diagnostiques,
- des notifications lifecycle (email/slack) planifiées.

Entrée principale:
- `backend/app/analysis/engine.py::analyze_deployment(deployment_id, db)`

Sorties persistées:
- `deployment_verdicts`
- `sdh_hints`
- mise à jour `deployments.state = analyzed`
- jobs `scheduled_jobs` pour notifications

## 2) Pré-conditions d'entrée
`analyze_deployment` traite seulement un deployment en état `finished`.

Conditions minimales:
- au moins 1 sample `pre`
- au moins 1 sample `post`

Sinon:
- verdict `warning` "Insufficient metrics to assess deployment health"
- deployment passe à `analyzed`

## 3) Agrégation des métriques
### 3.1 Post-aggregation
Moyenne de tous les samples `post`:
- `latency_p95`
- `error_rate`
- `cpu_usage`
- `memory_usage`
- `requests_per_sec`

### 3.2 Baseline PRE (uniformisée)
Moyenne de tous les samples `pre` (alignée API SDH + moteur):
- même set de métriques que ci-dessus

## 4) Audit de persistance (source de vérité verdict)
### 4.1 Seuils sécurisés
- `secured_threshold = INDUSTRIAL_THRESHOLDS[metric] * SECURED_THRESHOLD_FACTOR`

### 4.2 Comptage par séquence POST
Pour chaque sample `post`, on compte les dépassements:
- `latency/error/cpu/memory`: `sample > secured_threshold`
- `requests_per_sec`: baisse relative `> RPS_DROP_THRESHOLD` vs baseline PRE

### 4.3 Ratios
`exceed_ratio = exceed_count / total_post_sequences`

### 4.4 Tolérances
Comparaison `exceed_ratio > tolerance`:
- tolérances standard via `TOLERANCES`
- traffic drop via `RPS_PERSISTENCE_TOLERANCE`

Le résultat construit:
- `flags` textuels (détails explicatifs)
- `failed_metrics` (set des métriques en breach persistant)
- `metrics_audit` (payload structuré stocké avec hints SDH)

## 5) Décision de verdict
Règles actuelles:
- aucun échec persistant -> `ok`
- échec critique (`error_rate` ou `requests_per_sec`) -> `rollback_recommended`
- un seul échec non critique -> `warning`
- plusieurs échecs non critiques -> `rollback_recommended`

Confiance:
- `ok`: 0.9
- `warning`: 0.7
- `rollback_recommended`: 0.85

## 6) Persistance transactionnelle
Ordre logique:
1. upsert idempotent du verdict (`on_conflict_do_nothing` sur `deployment_id`)
2. génération hints SDH (si verdict créé)
3. `deployment.state = "analyzed"`
4. `db.commit()` unique pour données d'analyse

## 7) Génération SDH (diagnostic humain)
Entrée:
- `pre_agg`, `post_agg`
- `metrics_audit` (ratios/tolérances/secured thresholds)

### 7.1 Priorité audit vs seuil absolu
Si une métrique est couverte par `metrics_audit`:
- priorité aux signaux de persistance (`exceed_ratio > tolerance`)
- on évite les hints absolus contradictoires sur cette métrique

Fallback:
- seuils absolus utilisés pour métriques non couvertes par audit

### 7.2 Hints critiques garantis
Si audit détecte des breaches critiques persistants:
- création d'un hint composite critique explicite
- fallback de sécurité: ajoute un hint critique si aucun hint critique n'existe

### 7.3 Taille du payload `audit_data`
Optimisée par hint:
- hint simple -> audit local de la métrique
- hint composite -> audit des métriques composantes uniquement

## 8) Notifications lifecycle (post-commit analyse)
Après commit de l'analyse:
- planification des jobs email/slack "first verdict" et "critical verdict"
- insertion en lot avec un commit unique notification (réduction des états partiels intra-notifications)

Types notables:
- Email: `E-ACT-04`, `E-ACT-05`
- Slack: `SLACK_TYPE_FIRST_VERDICT_AVAILABLE`, `SLACK_TYPE_CRITICAL_VERDICT_ALERT`

## 9) Exposition API SDH
Route:
- `GET /sdh`

Pipeline API:
1. jointure `sdh_hints + deployments + projects`
2. filtrage par owner / project / deployment / severity
3. enrichissement `composite_signals` via:
   - agrégats `pre/post` par deployment
   - `hint.audit_data` (secured_threshold, exceed_ratio, tolerance)

Règle `requests_per_sec` dans `composite_signals`:
- `threshold` = baseline PRE agrégée (pas seuil industriel absolu)

## 10) Idempotence et comportement répété
Le verdict est idempotent par deployment (`on_conflict_do_nothing`).

Conséquences:
- premier passage: verdict créé + hints générés + notifications lifecycle
- passages suivants: pas de nouveau verdict, pas de régénération SDH liée au verdict

## 11) Couverture de tests recommandée/présente
Présente:
- logique d'analyse ratio/tolérance
- idempotence verdict
- cohérence SDH avec audit persistant
- route SDH (composite signals enrichis)

À maintenir:
- tests de non-régression sur priorités audit/absolu
- tests de cohérence `verdict -> hints -> API payload`

## 12) Résumé exécutable (checklist opératoire)
1. Collecter `pre/post` samples.
2. Calculer `pre_agg/post_agg` (moyennes).
3. Calculer `exceed_ratios` vs `secured_thresholds`.
4. Déterminer `failed_metrics` et verdict.
5. Persister verdict + hints + state en commit unique.
6. Planifier notifications en lot.
7. Servir `/sdh` avec composite_signals enrichis.

## 13) Observabilité qualité décision (SRE)
Métriques Prometheus exposées:
- `seqpulse_analysis_verdict_total{verdict,created}`
- `seqpulse_analysis_hint_total{severity}`
- `seqpulse_analysis_verdict_hint_consistency_total{verdict,consistency}`
- `seqpulse_analysis_quality_proxy_total{event}`
  - `false_rollback_proxy`
  - `missed_critical_proxy`
  - `verdict_hint_mismatch`
- `seqpulse_analysis_failed_metric_total{metric,critical}`

Interprétation SRE:
- `verdict_hint_consistency` suit la cohérence explicative.
- `missed_critical_proxy` doit tendre vers 0.
- `false_rollback_proxy` sert de signal d'agressivité du moteur (proxy, pas vérité terrain).

## 14) Alerting orienté incident (actionnable)
Objectif: déclencher sur des signaux exploitables, pas seulement informatifs.

### 14.1 Alerte `ANALYSIS_FALSE_ROLLBACK_SUSPECTED`
Déclenchement recommandé (PromQL):
```promql
increase(seqpulse_analysis_quality_proxy_total{event="false_rollback_proxy"}[15m]) > 0
```

Garde-fou volume (optionnel):
```promql
sum(increase(seqpulse_analysis_verdict_total{verdict="rollback_recommended",created="true"}[30m])) >= 3
```

### 14.2 Alerte `ANALYSIS_MISSED_CRITICAL_SUSPECTED`
Déclenchement recommandé (PromQL):
```promql
increase(seqpulse_analysis_quality_proxy_total{event="missed_critical_proxy"}[15m]) > 0
```

Signal complémentaire de mismatch verdict/hints:
```promql
increase(seqpulse_analysis_quality_proxy_total{event="verdict_hint_mismatch"}[15m]) > 0
```

### 14.3 Règle d'escalade
- SEV2 si 1 incident isolé.
- SEV1 si >= 3 incidents similaires en 30 min ou impact business confirmé (rollback prod incorrect / non rollback alors incident client).

## 15) Runbook Incident - Faux Rollback
Définition opérationnelle: verdict `rollback_recommended` jugé trop agressif après triage des métriques et de la qualité de données.

### 15.1 Triage (0-10 min)
Entrées:
- `:deployment_id` (UUID)
- `:project_id` (UUID)

SQL - contexte verdict/deployment:
```sql
SELECT
  d.id AS deployment_id,
  d.project_id,
  d.env,
  d.state,
  d.pipeline_result,
  d.started_at,
  d.finished_at,
  v.verdict,
  v.confidence,
  v.summary,
  v.details,
  v.created_at AS verdict_created_at
FROM deployments d
LEFT JOIN deployment_verdicts v ON v.deployment_id = d.id
WHERE d.id = :deployment_id;
```

SQL - score qualité des données extrait des `details`:
```sql
SELECT
  dv.deployment_id,
  MAX(
    CASE
      WHEN d LIKE 'data_quality_score %' THEN split_part(d, ' ', 2)::float
      ELSE NULL
    END
  ) AS data_quality_score,
  ARRAY_AGG(d) FILTER (WHERE d LIKE 'data_quality_issue %') AS data_quality_issues
FROM deployment_verdicts dv
LEFT JOIN LATERAL unnest(COALESCE(dv.details, ARRAY[]::text[])) AS d ON true
WHERE dv.deployment_id = :deployment_id
GROUP BY dv.deployment_id;
```

SQL - check métriques `pre/post` et persistance des dépassements (seuils sécurisés moteur):
- `latency_p95 > 270` (300 * 0.9), tolérance 0.20
- `error_rate > 0.009` (0.01 * 0.9), tolérance 0.05
- `cpu_usage > 0.72` (0.80 * 0.9), tolérance 0.20
- `memory_usage > 0.72` (0.80 * 0.9), tolérance 0.10
- `requests_per_sec` drop > 20%, tolérance 0.20
```sql
WITH pre AS (
  SELECT
    deployment_id,
    AVG(requests_per_sec) AS pre_rps
  FROM metric_samples
  WHERE deployment_id = :deployment_id
    AND phase = 'pre'
  GROUP BY deployment_id
),
post AS (
  SELECT
    m.deployment_id,
    COUNT(*) AS post_count,
    AVG(m.latency_p95) AS post_latency_p95,
    AVG(m.error_rate) AS post_error_rate,
    AVG(m.cpu_usage) AS post_cpu_usage,
    AVG(m.memory_usage) AS post_memory_usage,
    AVG(m.requests_per_sec) AS post_rps,
    SUM(CASE WHEN m.latency_p95 > 270 THEN 1 ELSE 0 END)::float / NULLIF(COUNT(*), 0) AS latency_exceed_ratio,
    SUM(CASE WHEN m.error_rate > 0.009 THEN 1 ELSE 0 END)::float / NULLIF(COUNT(*), 0) AS error_exceed_ratio,
    SUM(CASE WHEN m.cpu_usage > 0.72 THEN 1 ELSE 0 END)::float / NULLIF(COUNT(*), 0) AS cpu_exceed_ratio,
    SUM(CASE WHEN m.memory_usage > 0.72 THEN 1 ELSE 0 END)::float / NULLIF(COUNT(*), 0) AS memory_exceed_ratio,
    SUM(
      CASE
        WHEN p.pre_rps > 0 AND ((p.pre_rps - m.requests_per_sec) / p.pre_rps) > 0.20 THEN 1
        ELSE 0
      END
    )::float / NULLIF(COUNT(*), 0) AS rps_drop_exceed_ratio
  FROM metric_samples m
  LEFT JOIN pre p ON p.deployment_id = m.deployment_id
  WHERE m.deployment_id = :deployment_id
    AND m.phase = 'post'
  GROUP BY m.deployment_id
)
SELECT
  *,
  (error_exceed_ratio > 0.05 OR rps_drop_exceed_ratio > 0.20) AS critical_failed
FROM post;
```

SQL - hints produits (cohérence explicative):
```sql
SELECT
  metric,
  severity,
  confidence,
  exceed_ratio,
  tolerance,
  created_at
FROM sdh_hints
WHERE deployment_id = :deployment_id
ORDER BY created_at, severity DESC;
```

### 15.2 Critères décisionnels (rollback applicatif vs replay analyse)
Rollback applicatif recommandé si:
- `critical_failed = true` dans la requête métrique ci-dessus, et
- `data_quality_score >= 0.70` (ou pas de signal de mauvaise qualité), et
- impact runtime confirmé (erreurs/latence côté prod).

Replay analyse recommandé si:
- `critical_failed = false`, et
- verdict = `rollback_recommended`, et
- au moins un signal qualité faible (`data_quality_score < 0.70`, `min_post_samples`, clock skew/timestamps incohérents, trous de séquence).

### 15.3 Procédure replay (contrôlée)
1. Geler la décision rollback applicative (ne pas rollback tant que replay non terminé).
2. Réinitialiser l’artefact d’analyse et replanifier `analysis`.

SQL - reset artefacts + réarmement du dernier job d’analyse:
```sql
BEGIN;

SELECT id, state
FROM deployments
WHERE id = :deployment_id
FOR UPDATE;

DELETE FROM sdh_hints
WHERE deployment_id = :deployment_id;

DELETE FROM deployment_verdicts
WHERE deployment_id = :deployment_id;

UPDATE deployments
SET state = 'finished'
WHERE id = :deployment_id;

UPDATE scheduled_jobs
SET
  status = 'pending',
  retry_count = 0,
  last_error = NULL,
  scheduled_at = NOW(),
  updated_at = NOW()
WHERE id = (
  SELECT id
  FROM scheduled_jobs
  WHERE deployment_id = :deployment_id
    AND job_type = 'analysis'
  ORDER BY created_at DESC
  LIMIT 1
);

COMMIT;
```

3. Vérifier que le job `analysis` est repris:
```sql
SELECT id, status, retry_count, last_error, scheduled_at, updated_at
FROM scheduled_jobs
WHERE deployment_id = :deployment_id
  AND job_type = 'analysis'
ORDER BY created_at DESC
LIMIT 3;
```

## 16) Runbook Incident - Critical Raté
Définition opérationnelle: verdict final `ok`/`warning` alors que des signaux critiques persistants suggèrent `rollback_recommended`.

### 16.1 Triage (0-10 min)
SQL - candidates récents suspects:
```sql
SELECT
  d.id AS deployment_id,
  d.project_id,
  d.env,
  d.pipeline_result,
  d.finished_at,
  v.verdict,
  v.confidence
FROM deployments d
JOIN deployment_verdicts v ON v.deployment_id = d.id
WHERE d.finished_at >= NOW() - INTERVAL '6 hours'
  AND v.verdict IN ('ok', 'warning')
ORDER BY d.finished_at DESC
LIMIT 100;
```

SQL - mismatch verdict/hints critiques:
```sql
SELECT
  d.id AS deployment_id,
  v.verdict,
  COUNT(*) FILTER (WHERE h.severity = 'critical') AS critical_hints
FROM deployments d
JOIN deployment_verdicts v ON v.deployment_id = d.id
LEFT JOIN sdh_hints h ON h.deployment_id = d.id
WHERE d.finished_at >= NOW() - INTERVAL '6 hours'
GROUP BY d.id, v.verdict
HAVING v.verdict <> 'rollback_recommended'
   AND COUNT(*) FILTER (WHERE h.severity = 'critical') > 0
ORDER BY deployment_id DESC;
```

SQL - recalcul des signaux critiques pour un deployment donné:
```sql
WITH pre AS (
  SELECT deployment_id, AVG(requests_per_sec) AS pre_rps
  FROM metric_samples
  WHERE deployment_id = :deployment_id
    AND phase = 'pre'
  GROUP BY deployment_id
),
post AS (
  SELECT
    m.deployment_id,
    COUNT(*) AS post_count,
    SUM(CASE WHEN m.error_rate > 0.009 THEN 1 ELSE 0 END)::float / NULLIF(COUNT(*), 0) AS error_exceed_ratio,
    SUM(
      CASE
        WHEN p.pre_rps > 0 AND ((p.pre_rps - m.requests_per_sec) / p.pre_rps) > 0.20 THEN 1
        ELSE 0
      END
    )::float / NULLIF(COUNT(*), 0) AS rps_drop_exceed_ratio
  FROM metric_samples m
  LEFT JOIN pre p ON p.deployment_id = m.deployment_id
  WHERE m.deployment_id = :deployment_id
    AND m.phase = 'post'
  GROUP BY m.deployment_id
)
SELECT
  post_count,
  error_exceed_ratio,
  rps_drop_exceed_ratio,
  (error_exceed_ratio > 0.05) AS error_persistent,
  (rps_drop_exceed_ratio > 0.20) AS rps_persistent
FROM post;
```

### 16.2 Critères décisionnels
Rollback applicatif immédiat si:
- `error_persistent = true` ou `rps_persistent = true`, et
- `post_count >= 5`, et
- `data_quality_score >= 0.70` (ou absence de signaux qualité faibles).

Replay analyse (prioritaire) si:
- suspicion critique mais qualité des données insuffisante (`post_count < 5`, timestamps incohérents, trous de séquence), ou
- incohérence verdict/hints sans confirmation métrique persistante.

### 16.3 Vérification notification critique (incident de diffusion)
SQL - état outbox critique par deployment:
```sql
SELECT
  sj.id,
  sj.status,
  sj.retry_count,
  sj.last_error,
  sj.created_at,
  sj.updated_at,
  n.value->>'channel' AS channel,
  n.value->'payload'->>'dedupe_key' AS dedupe_key,
  n.value->'payload'->>'email_type' AS email_type,
  n.value->'payload'->>'notification_type' AS notification_type
FROM scheduled_jobs sj
CROSS JOIN LATERAL jsonb_array_elements(COALESCE(sj.job_metadata->'notifications', '[]'::jsonb)) AS n(value)
WHERE sj.deployment_id = :deployment_id
  AND sj.job_type = 'notification_outbox'
ORDER BY sj.created_at DESC;
```

SQL - statut delivery final:
```sql
SELECT dedupe_key, status, sent_at, error_message
FROM email_deliveries
WHERE dedupe_key IN (
  SELECT n.value->'payload'->>'dedupe_key'
  FROM scheduled_jobs sj
  CROSS JOIN LATERAL jsonb_array_elements(COALESCE(sj.job_metadata->'notifications', '[]'::jsonb)) AS n(value)
  WHERE sj.deployment_id = :deployment_id
    AND sj.job_type = 'notification_outbox'
    AND n.value->>'channel' = 'email'
)
ORDER BY created_at DESC;
```

Si `notification_outbox` en `failed` mais incident encore actif:
- requeue le job outbox en `pending` avec `scheduled_at = NOW()`,
- vérifier ensuite `email_deliveries/slack_deliveries`.
