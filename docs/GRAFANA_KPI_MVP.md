# SEQPULSE - Grafana KPI MVP (a utiliser apres implementation lifecycle)

Derniere mise a jour: 19 fevrier 2026

## 0) Dashboard as code (deja provisionne)

Le dashboard KPI lifecycle est maintenu en JSON dans:

- `backend/observability/grafana/dashboards/seqpulse-kpi-mvp-lifecycle.json`

Le provisioning Grafana (datasources + dashboards) est dans:

- `backend/observability/grafana/provisioning/datasources/datasources.yml`
- `backend/observability/grafana/provisioning/dashboards/dashboards.yml`

Le detail panel/visualisation/threshold/layout est documente ici:

- `backend/observability/grafana/README.md`

## 1) Quand utiliser ce document

Utiliser ce guide **apres** la mise en place complete du lifecycle MVP:

1. E-TRX-01
2. E-ACT-01
3. E-ACT-04
4. E-ACT-05
5. E-CONV-01
6. E-CONV-03

Si ces triggers ne sont pas actifs, les KPI seront incomplets ou trompeurs.

## 2) Prerequis techniques

1. Grafana accessible (`http://localhost:3002` en local).
2. Datasource Prometheus deja en place (monitoring technique).
3. Datasource PostgreSQL ajoutee dans Grafana (pour KPI produit).
4. Table `email_deliveries` disponible.
5. (Optionnel pour open rate) table `email_events` disponible.

## 3) Datasource PostgreSQL (Grafana)

Dans Grafana:

1. `Connections -> Data sources -> Add data source -> PostgreSQL`
2. Host (docker local): `host.docker.internal:5432`
3. Database/User/Password: valeurs du `backend/.env`
4. `Save & Test`

## 3bis) Option endpoint backend (JSON)

Si tu preferes eviter SQL dans Grafana, tu peux utiliser l endpoint backend:

`GET /analytics/kpi/lifecycle?window_days=7`

Exemple reponse:

```json
{
  "window": {
    "from": "2026-02-12T10:00:00+00:00",
    "to": "2026-02-19T10:00:00+00:00",
    "days": 7,
    "computed_at": "2026-02-19T10:00:01Z"
  },
  "kpis": {
    "signup_to_project_24h": { "value": 42.86, "numerator": 6, "denominator": 14 },
    "project_to_first_verdict_72h": { "value": 55.0, "numerator": 11, "denominator": 20 },
    "free_to_pro_from_quota_emails": { "value": 12.5, "numerator": 1, "denominator": 8 },
    "critical_alert_open_rate": { "value": null, "available": false, "reason": "email_events_table_missing" }
  }
}
```

## 4) Dashboard a creer

Nom recommande: `SEQPULSE - KPI MVP Lifecycle`

Panels minimaux:

1. `signup_to_project_24h` (Stat, unite `%`)
2. `project_to_first_verdict_72h` (Stat, unite `%`)
3. `free_to_pro_from_quota_emails` (Stat, unite `%`)
4. `critical_alert_open_rate` (Stat, unite `%`) - seulement si tracking opens actif

Time range recommande:

1. `Last 7 days` (pilotage hebdo)
2. `Last 30 days` (tendance mensuelle)

## 5) Requetes SQL KPI (copier-coller)

## 5.1 KPI - signup_to_project_24h

```sql
WITH cohort AS (
  SELECT u.id, u.created_at
  FROM users u
  WHERE u.created_at BETWEEN $__timeFrom() AND $__timeTo()
),
activated AS (
  SELECT c.id
  FROM cohort c
  WHERE EXISTS (
    SELECT 1
    FROM projects p
    WHERE p.owner_id = c.id
      AND p.created_at <= c.created_at + interval '24 hour'
  )
)
SELECT
  CASE WHEN (SELECT COUNT(*) FROM cohort) = 0 THEN 0
  ELSE ROUND(100.0 * (SELECT COUNT(*) FROM activated) / (SELECT COUNT(*) FROM cohort), 2)
  END AS value;
```

## 5.2 KPI - project_to_first_verdict_72h

```sql
WITH cohort AS (
  SELECT p.id, p.created_at
  FROM projects p
  WHERE p.created_at BETWEEN $__timeFrom() AND $__timeTo()
),
first_verdict AS (
  SELECT
    c.id AS project_id,
    c.created_at AS project_created_at,
    MIN(dv.created_at) AS first_verdict_at
  FROM cohort c
  LEFT JOIN deployments d ON d.project_id = c.id
  LEFT JOIN deployment_verdicts dv ON dv.deployment_id = d.id
  GROUP BY c.id, c.created_at
),
hit AS (
  SELECT project_id
  FROM first_verdict
  WHERE first_verdict_at IS NOT NULL
    AND first_verdict_at <= project_created_at + interval '72 hour'
)
SELECT
  CASE WHEN (SELECT COUNT(*) FROM cohort) = 0 THEN 0
  ELSE ROUND(100.0 * (SELECT COUNT(*) FROM hit) / (SELECT COUNT(*) FROM cohort), 2)
  END AS value;
```

## 5.3 KPI - free_to_pro_from_quota_emails

```sql
WITH exposed AS (
  SELECT DISTINCT ed.project_id
  FROM email_deliveries ed
  WHERE ed.email_type IN ('E-CONV-01', 'E-CONV-03')
    AND ed.sent_at BETWEEN $__timeFrom() AND $__timeTo()
),
converted AS (
  SELECT e.project_id
  FROM exposed e
  JOIN projects p ON p.id = e.project_id
  WHERE p.plan = 'pro'
)
SELECT
  CASE WHEN (SELECT COUNT(*) FROM exposed) = 0 THEN 0
  ELSE ROUND(100.0 * (SELECT COUNT(*) FROM converted) / (SELECT COUNT(*) FROM exposed), 2)
  END AS value;
```

## 5.4 KPI - critical_alert_open_rate (optionnel)

Necessite tracking open email (ex: webhook provider -> table `email_events`).

```sql
WITH sent AS (
  SELECT ed.id
  FROM email_deliveries ed
  WHERE ed.email_type = 'E-ACT-05'
    AND ed.sent_at BETWEEN $__timeFrom() AND $__timeTo()
),
opened AS (
  SELECT DISTINCT s.id
  FROM sent s
  JOIN email_events ee ON ee.email_delivery_id = s.id
  WHERE ee.event_type = 'opened'
)
SELECT
  CASE WHEN (SELECT COUNT(*) FROM sent) = 0 THEN 0
  ELSE ROUND(100.0 * (SELECT COUNT(*) FROM opened) / (SELECT COUNT(*) FROM sent), 2)
  END AS value;
```

## 6) Panel tendance (recommande)

En plus des panels `Stat`, ajouter des panels `Time series` pour voir l'evolution.

Exemple (signup_to_project_24h journalier):

```sql
WITH days AS (
  SELECT generate_series(
    date_trunc('day', $__timeFrom()::timestamp),
    date_trunc('day', $__timeTo()::timestamp),
    interval '1 day'
  ) AS day
),
cohort AS (
  SELECT d.day, u.id, u.created_at
  FROM days d
  LEFT JOIN users u
    ON u.created_at >= d.day
   AND u.created_at < d.day + interval '1 day'
),
daily AS (
  SELECT
    day,
    COUNT(id) AS total_signups,
    COUNT(*) FILTER (
      WHERE id IS NOT NULL
        AND EXISTS (
          SELECT 1
          FROM projects p
          WHERE p.owner_id = cohort.id
            AND p.created_at <= cohort.created_at + interval '24 hour'
        )
    ) AS activated_signups
  FROM cohort
  GROUP BY day
)
SELECT
  day AS "time",
  CASE WHEN total_signups = 0 THEN 0
       ELSE ROUND(100.0 * activated_signups / total_signups, 2)
  END AS value
FROM daily
ORDER BY day;
```

## 7) Seuils recommandes (MVP)

Utiliser des seuils simples dans Grafana (color thresholds):

1. `signup_to_project_24h`: rouge < 30, orange < 45, vert >= 45
2. `project_to_first_verdict_72h`: rouge < 25, orange < 40, vert >= 40
3. `free_to_pro_from_quota_emails`: rouge < 5, orange < 10, vert >= 10
4. `critical_alert_open_rate`: rouge < 35, orange < 55, vert >= 55

Ces seuils sont des bases MVP; ajuster apres 2-4 semaines de donnees reelles.

## 8) Checklist "ready to use"

1. Lifecycle MVP deploye.
2. `email_deliveries` alimentee en prod.
3. Datasource PostgreSQL connectee dans Grafana.
4. Dashboard cree avec 4 panels KPI.
5. Revue hebdo des KPI planifiee.
