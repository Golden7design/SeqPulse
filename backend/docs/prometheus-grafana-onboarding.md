# SeqPulse - Onboarding Monitoring (Prometheus + Grafana)

Ce document explique a un nouveau dev comment comprendre et utiliser le monitoring actuel de SeqPulse.

## 1) Objectif

Le but est de rendre visible en continu:
- la sante API,
- la sante scheduler,
- la collecte des metrics,
- la performance des analyses.

Les logs structures servent au debug detaille.
Les metrics Prometheus servent a voir les tendances et a alerter.

## 2) Architecture en place

Flux actuel:
1. Le backend expose `/metrics` (Prometheus format).
2. Prometheus scrape le backend.
3. Grafana lit Prometheus et affiche les dashboards.

Fichiers cles:
- `backend/app/observability/metrics.py` (definition des metrics)
- `backend/app/main.py` (middleware HTTP + endpoint `/metrics`)
- `backend/app/scheduler/poller.py` (metrics scheduler)
- `backend/app/metrics/collector.py` (metrics collecte)
- `backend/app/analysis/engine.py` (metrics duree analyse)
- `backend/observability/prometheus/prometheus.yml` (scrape config)
- `backend/observability/prometheus/docker-compose.yml` (stack Prometheus/Grafana)

## 3) Metrics exposees

SeqPulse expose ces metrics metier:
- `seqpulse_http_requests_total` (Counter)
- `seqpulse_http_request_duration_seconds` (Histogram)
- `seqpulse_scheduler_jobs_pending` (Gauge)
- `seqpulse_scheduler_jobs_failed_total` (Counter)
- `seqpulse_metrics_collected_total` (Counter, label `phase`)
- `seqpulse_analysis_duration_seconds` (Histogram, label `outcome`)

Prometheus expose aussi des metrics runtime Python/process:
- `python_*`
- `process_*`

## 4) Runbook local (quickstart)

Pre-requis:
- backend lance sur `127.0.0.1:8000` ou `0.0.0.0:8000`
- docker + docker compose installes

Commandes:

```bash
# depuis la racine du repo
cd backend
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

```bash
# dans un autre terminal
cd backend/observability/prometheus
sudo docker compose up -d
```

Verification Prometheus:
- URL: `http://localhost:9090`
- `Status -> Targets`
- target `seqpulse-backend` doit etre `UP`

Verification Grafana:
- URL: `http://localhost:3002`
- login par defaut: `admin/admin`
- datasources provisionnees automatiquement:
  - Prometheus (`DS_PROMETHEUS`) -> `http://host.docker.internal:9090`
  - PostgreSQL (`DS_POSTGRESQL`) -> variables `GRAFANA_SQL_*` dans `docker-compose`

Dashboard KPI lifecycle provisionne automatiquement:
- `SEQPULSE/SEQPULSE - KPI MVP Lifecycle`

Dashboard monitoring initial (Prometheus) provisionne automatiquement:
- `SEQPULSE/SEQPULSE - Monitoring MVP`

## 5) Dashboard MVP a creer (6 panels)

Panel 1 - HTTP Requests/s

```promql
sum(rate(seqpulse_http_requests_total[5m]))
```

Interprete:
- monte -> charge API augmente
- tombe a 0 -> plus de trafic ou probleme ingress

Panel 2 - HTTP Latency p95

```promql
histogram_quantile(0.95, sum(rate(seqpulse_http_request_duration_seconds_bucket[5m])) by (le))
```

Interprete:
- indique le temps de reponse "worst normal"
- derive continue = degradation utilisateur

Panel 3 - Scheduler Pending Jobs

```promql
seqpulse_scheduler_jobs_pending
```

Interprete:
- backlog instantane
- si ca monte et ne redescend pas, le poller ne suit plus

Panel 4 - Scheduler Failed Jobs (1h)

```promql
increase(seqpulse_scheduler_jobs_failed_total[1h])
```

Interprete:
- nombre d echecs recents scheduler
- pic soudain = incident a investiguer

Panel 5 - Metrics Collected/s by Phase

```promql
sum by (phase) (rate(seqpulse_metrics_collected_total[5m]))
```

Interprete:
- visualise cadence de collecte `pre` vs `post`
- utile pour verifier que le pipeline collecte fonctionne

Panel 6 - Analysis Duration p95 by Outcome

```promql
histogram_quantile(0.95, sum(rate(seqpulse_analysis_duration_seconds_bucket[5m])) by (le, outcome))
```

Interprete:
- compare latence d analyse selon issue (`ok`, `attention`, `rollback_recommended`, etc.)
- aide a cibler les cas couteux

## 6) Pourquoi un panel peut etre vide

C est normal au debut.
Certaines series n apparaissent qu apres le premier evenement.

Exemples:
- pas de trafic API recent -> panels HTTP vides
- pas de collecte `pre/post` -> panel collecte vide
- pas d analyse executee -> panel analyse vide

Pour alimenter rapidement:
- appeler `/health` et `/db-check`,
- lancer un cycle de deploiement,
- attendre 1 a 2 scrapes Prometheus.

## 7) Troubleshooting rapide

`connection refused` dans Prometheus:
- verifier backend lance (meme en `--host 127.0.0.1`, supporte par la config actuelle)
- verifier port `8000` ouvert
- verifier target dans `prometheus.yml`

Target down:
- verifier `Status -> Targets`
- verifier `curl http://localhost:8000/metrics` depuis host

Rien dans Grafana:
- verifier datasource Prometheus
- augmenter range temps (`Last 1 hour`)
- cliquer `Run query`
- supprimer `;` final dans requetes PromQL

## 8) Ce qu il faut ajouter ensuite

1. Alert rules Prometheus:
- failed jobs > 0 sur 15 min
- p95 HTTP > seuil
- pending jobs > seuil pendant N minutes

2. Dashboard operations:
- seuils visuels rouge/orange/vert
- variables par environnement

3. Documentation d incident:
- runbook "si panel X degrade, verifier Y"
