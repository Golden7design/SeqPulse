# SeqPulse - Guide d'integration Graylog (recommande)

Ce guide explique quoi faire quand tu voudras brancher SeqPulse a une plateforme de logs centralisee.

## Pourquoi je recommande Graylog ici
- Focus logs + alerting, plus simple a exploiter rapidement qu'un ELK complet.
- Bonne UX pour filtrer les champs structures (`event`, `deployment_id`, `phase`, `duration_ms`).
- Adapte a un MVP/scale-up sans surcharger l'ops.

## Ce que ton backend a deja
- Logs JSON structures via `structlog`.
- Evenements metier coherents (`metrics_collected`, `job_failed`, `deployment_finished`, etc.).
- Champs techniques utiles pour debug (`error`, `retry_count`, `duration_ms`).

Consequence: tu n'as pas besoin de re-coder le backend pour commencer.

## Architecture recommandee (simple)
1. App FastAPI ecrit les logs JSON sur `stdout`.
2. Un collecteur lit les logs runtime (Docker, systemd, ou fichier).
3. Le collecteur envoie vers Graylog Input (GELF ou Beats).
4. Graylog indexe, dashboarde, et declenche les alertes.

## Plan d'implementation

### Etape 1 - Demarrage local (POC)
1. Lancer Graylog en local (Docker Compose).
2. Creer un Input Graylog:
   - Option A: `GELF HTTP` (simple pour tests).
   - Option B: `Beats` (si Filebeat).
3. Envoyer quelques logs de test.
4. Verifier que les champs JSON apparaissent comme champs recherchables.

### Etape 2 - Connexion backend
Choisir 1 mode d'ingestion:

- Mode A (recommande au debut): collecteur externe
  - Garder l'app telle quelle (stdout JSON).
  - Ajouter Filebeat/Vector/Fluent Bit pour shipper vers Graylog.
  - Avantage: pas de coupling applicatif.

- Mode B: emission directe GELF depuis l'app
  - Ajouter un handler GELF Python.
  - Avantage: direct.
  - Inconvenient: coupling fort + gestion reseau dans l'app.

### Etape 3 - Normalisation des champs
Dans Graylog, creer un pipeline/ruleset pour forcer ces champs:
- `service` (ex: `seqpulse-backend`)
- `env` (`dev`, `staging`, `prod`)
- `event`
- `level`
- `deployment_id`
- `project_id`
- `phase`
- `duration_ms`
- `error`

Objectif: memes filtres sur tous les environnements.

### Etape 4 - Dashboards minimum
Creer 4 widgets de base:
1. `Errors/min` par `event`
2. `job_failed` et `job_retry_scheduled` sur 24h
3. P95 `duration_ms` pour `metrics_collected`
4. Volume de logs par `level` et par `service`

### Etape 5 - Alertes
Configurer des alertes actionnables:
1. Spike d'erreurs: `level=error OR event=job_failed`
2. Retry anormal: `event=job_retry_scheduled` au-dessus d'un seuil
3. Latence forte: `event=metrics_collected AND duration_ms > X`
4. Silence: absence de logs backend pendant N minutes

## Requetes utiles (exemples Graylog)
- Erreurs metrics:
  - `event:metrics_fetch_failed OR event:metrics_http_status_error`
- Echecs scheduler:
  - `event:job_failed OR event:job_recovery_failed`
- Latence collecte post-deploiement:
  - `event:metrics_collected AND phase:post`
- Trace d'un deploiement:
  - `deployment_id:<UUID>`

## Checklist de mise en prod
- [ ] Input Graylog protege (auth + reseau prive + TLS)
- [ ] Rotation/retention des index definie
- [ ] Champs obligatoires normalises (`service`, `env`, `event`, `level`)
- [ ] Dashboard "Ops SeqPulse" publie
- [ ] Alertes connectees (Slack/Email/Webhook)
- [ ] Test incident realise (simulation `job_failed`)

## Evolution plus tard
Si ton volume de logs devient tres eleve, tu pourras:
1. Garder Graylog en facade
2. Faire evoluer le backend de stockage/indexation
3. Introduire une strategie de sampling pour les logs a fort debit

## Decision rapide: Graylog vs ELK
- Prends **Graylog** si tu veux aller vite sur logs+alertes avec peu d'ops.
- Prends **ELK** si tu veux un controle tres fin de la chaine ingestion/indexation et une equipe ops plus mature.
