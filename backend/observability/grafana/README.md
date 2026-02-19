# Dashboard KPI Grafana - SEQPULSE

## Ce qui est en place

- Dashboard as code: `backend/observability/grafana/dashboards/seqpulse-monitoring-mvp.json`
- Dashboard as code: `backend/observability/grafana/dashboards/seqpulse-kpi-mvp-lifecycle.json`
- Provisioning dashboards: `backend/observability/grafana/provisioning/dashboards/dashboards.yml`
- Provisioning datasources: `backend/observability/grafana/provisioning/datasources/datasources.yml`
- Docker compose branche: `backend/observability/prometheus/docker-compose.yml`

## Lancer la stack

```bash
cd backend/observability/prometheus
docker compose up -d
```

Grafana: `http://localhost:3002` (admin/admin)

## Variables PostgreSQL (optionnel)

Le datasource PostgreSQL est provisionne automatiquement via ces variables:

- `GRAFANA_SQL_HOST` (defaut: `host.docker.internal:5432`)
- `GRAFANA_SQL_DATABASE` (defaut: `seqpulse`)
- `GRAFANA_SQL_USER` (defaut: `postgres`)
- `GRAFANA_SQL_PASSWORD` (defaut: `postgres`)

Exemple:

```bash
GRAFANA_SQL_HOST=host.docker.internal:5432 \
GRAFANA_SQL_DATABASE=seqpulse \
GRAFANA_SQL_USER=seqpulse_user \
GRAFANA_SQL_PASSWORD=secret \
docker compose up -d
```

## Panels (nom, visualisation, thresholds, layout)

| Panel | Visualisation | Thresholds | Layout |
|---|---|---|---|
| `signup_to_project_24h` | `Stat` | rouge < 30, orange < 45, vert >= 45 | `x=0,y=0,w=6,h=5` |
| `project_to_first_verdict_72h` | `Stat` | rouge < 25, orange < 40, vert >= 40 | `x=6,y=0,w=6,h=5` |
| `free_to_pro_from_quota_emails` | `Stat` | rouge < 5, orange < 10, vert >= 10 | `x=12,y=0,w=6,h=5` |
| `critical_alert_open_rate` | `Stat` | rouge < 35, orange < 55, vert >= 55 | `x=18,y=0,w=6,h=5` |
| `Trend - signup_to_project_24h (daily)` | `Time series` | pas de seuil couleur (lecture tendance) | `x=0,y=5,w=12,h=8` |
| `Trend - project_to_first_verdict_72h (daily)` | `Time series` | pas de seuil couleur (lecture tendance) | `x=12,y=5,w=12,h=8` |
| `Trend - free_to_pro_from_quota_emails (daily)` | `Time series` | pas de seuil couleur (lecture tendance) | `x=0,y=13,w=12,h=8` |
| `Trend - critical_alert_open_rate (daily)` | `Time series` | pas de seuil couleur (lecture tendance) | `x=12,y=13,w=12,h=8` |

## Verification rapide

1. Ouvrir Grafana et verifier le folder `SEQPULSE`.
2. Ouvrir `SEQPULSE - Monitoring MVP` (dashboard initial Prometheus).
3. Ouvrir `SEQPULSE - KPI MVP Lifecycle`.
4. Verifier que les panels chargent sans erreur datasource.
5. Regler la periode sur `Last 7 days` puis `Last 30 days`.
