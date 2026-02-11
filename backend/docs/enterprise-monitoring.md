# SeqPulse — Monitoring Temps Réel (Plan Enterprise)

Ce document décrit **l’implémentation d’un monitoring temps réel** réservé aux projets **Enterprise**.

---

**Objectif**
- Afficher en quasi temps réel les 5 métriques :
  - `requests_per_sec`
  - `latency_p95`
  - `error_rate`
  - `cpu_usage`
  - `memory_usage`
- Réservé **uniquement** aux projets avec `plan = "enterprise"`.
- Latence cible d’affichage : **≤ 60s**.

---

**1) Contrat d’accès (gating Enterprise)**
À chaque requête “monitoring temps réel” :
- Récupérer le projet.
- Vérifier `project.plan == "enterprise"`.
- Sinon → `403 Forbidden`.

---

**2) Source de données (time‑series)**
**Option choisie : Tout dans SeqPulse (sans Prometheus/Grafana).**

On utilise une **table time‑series dédiée** dans Postgres (ou TimescaleDB si disponible).
Le dashboard SeqPulse consomme **directement l’API SeqPulse**.

---

**3) Modèle de métriques (labels)**
Pour éviter la surcharge (cardinalité) :
- **Autorisés** : `project_id`, `env`, `phase`
- **Interdit** : `deployment_id` (trop de cardinalité)

Exemple de série :
```
seqpulse_requests_per_sec{project_id="...", env="prod", phase="post"}
```

---

**4) Fréquence de collecte**
Pour Enterprise :
- `POLL_INTERVAL` (collecte) : **15s** (ou 30s max)
- Agrégation côté affichage possible à **60s**

---

**5) Endpoint API “Enterprise monitoring”**
Créer un endpoint REST (exemple) :
```
GET /monitoring/enterprise/timeseries
```
Query params :
- `project_id`
- `from`, `to`
- `step` (ex: 15s, 30s, 60s)

Retour :
```json
{
  "series": {
    "requests_per_sec": [...],
    "latency_p95": [...],
    "error_rate": [...],
    "cpu_usage": [...],
    "memory_usage": [...]
  },
  "step": "15s",
  "from": "...",
  "to": "..."
}
```

**Gating** : vérifier `plan=enterprise` avant de répondre.

---

**6) Dashboards**
Mettre en place un dashboard “Enterprise” avec :
- Requests/sec
- Latency P95
- Error rate
- CPU usage
- Memory usage

Filtrable par :
- Projet
- Environnement
- Phase (pre/post)

---

**7) Alertes minimales (Enterprise)**
Configurer des alertes **directement dans SeqPulse** :
- `error_rate > 1%` sur 5 min
- `latency_p95 > seuil` sur 5 min
- `cpu_usage > 80%` sur 5 min
- `memory_usage > 85%` sur 5 min
- `no data` pendant 5–10 min

---

**8) Observabilité de SeqPulse**
Expose aussi l’état interne :
- `pending/running/failed` jobs
- `stuck_running`
- durée moyenne de collecte/analyse

Endpoint existant :
```
GET /health/scheduler
```

---

**9) Sécurité & isolation**
- Pas d’accès monitoring pour `free/pro`.
- Loguer chaque accès au endpoint Enterprise.
- (Option) limiter par API key + scope.

---

**10) Stratégie de rollout**
1. Implémenter le gating enterprise.
2. Déployer la table time‑series.
3. Exposer l’API timeseries.
4. Dashboard SeqPulse + alertes internes.
5. Lancer sur 1 projet pilote.
6. Étendre à tous les projets Enterprise.

---

**Résumé**
Le monitoring temps réel Enterprise repose sur :
- un stockage time‑series interne,
- un gating strict sur `plan=enterprise`,
- un dashboard SeqPulse unifié,
- des alertes intégrées.

Ce scope fournit un monitoring “acceptable” pour une équipe DevOps, **sans dépendance externe**.
