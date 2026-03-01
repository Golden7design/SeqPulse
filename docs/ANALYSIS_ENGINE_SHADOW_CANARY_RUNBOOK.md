# SeqPulse - Runbook Shadow/Canary pour un Nouveau Moteur d'Analyse

## Objectif
Ce runbook standardise le test et le déploiement d'un nouveau moteur d'analyse (`v2`, `v3`, etc.) sans régression silencieuse.

Principes non négociables:
- Le moteur actif reste la source de vérité tant que les gates de promotion ne sont pas validées.
- Le nouveau moteur tourne en parallèle (shadow), puis en canary progressif.
- Les écarts sont persistés dans une table dédiée pour audit, debug et décision de go/no-go.

## Scope
Ce document couvre:
- le mode `shadow`,
- le mode `canary`,
- la table dédiée de comparaison,
- les critères de promotion/rollback.

Ce document ne couvre pas:
- la définition métier des seuils/tolérances,
- la logique interne SDH.

## Références code
- [`backend/app/analysis/engine.py`](/home/nassir/Documents/Workflow/SEQPULSE/backend/app/analysis/engine.py)
- [`backend/app/core/settings.py`](/home/nassir/Documents/Workflow/SEQPULSE/backend/app/core/settings.py)
- [`backend/app/observability/metrics.py`](/home/nassir/Documents/Workflow/SEQPULSE/backend/app/observability/metrics.py)

## Terminologie
- `active engine`: moteur en production qui décide le verdict persistant.
- `candidate engine`: nouveau moteur testé (`shadow` puis `canary`).
- `shadow`: exécution parallèle sans impact métier.
- `canary`: une fraction du trafic décisionnel bascule sur le candidate engine.

## Architecture cible (résumé)
Pour chaque `deployment` analysé:
1. Calcul du résultat `active`.
2. Calcul du résultat `candidate` (si activé).
3. Persistance dans table dédiée `analysis_engine_comparisons`.
4. Persistance du verdict de référence:
- en `shadow`: toujours `active`.
- en `canary`: `active` ou `candidate` selon bucket.
5. Notifications (email/slack) alignées sur le verdict de référence seulement.

## Flags de configuration recommandés
Ajouter dans `Settings`:
- `ANALYSIS_ACTIVE_VERSION: str = "v1"`
- `ANALYSIS_CANDIDATE_VERSION: str = "v2"`
- `ANALYSIS_SHADOW_ENABLED: bool = True`
- `ANALYSIS_CANARY_PERCENT: int = 0`
- `ANALYSIS_CANARY_SALT: str = "seqpulse-analysis-canary-v1"`

Règles:
- `ANALYSIS_CANARY_PERCENT=0` => shadow only.
- `ANALYSIS_CANARY_PERCENT>0` => canary activé.

## Stratégie de bucketing canary
Utiliser un hash stable sur `project_id`:
- `bucket = stable_hash(f"{project_id}:{salt}") % 100`
- candidate engine décide si `bucket < ANALYSIS_CANARY_PERCENT`

Contraintes:
- déterministe,
- stable dans le temps,
- distribué uniformément.

## Table dédiée (obligatoire)
Créer une table dédiée pour historiser chaque comparaison active/candidate.

### DDL PostgreSQL proposé
```sql
CREATE TABLE analysis_engine_comparisons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deployment_id UUID NOT NULL REFERENCES deployments(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,

  mode VARCHAR(16) NOT NULL CHECK (mode IN ('shadow', 'canary')),
  active_version VARCHAR(32) NOT NULL,
  candidate_version VARCHAR(32) NOT NULL,
  canary_percent SMALLINT NOT NULL DEFAULT 0 CHECK (canary_percent BETWEEN 0 AND 100),
  canary_bucket SMALLINT NOT NULL CHECK (canary_bucket BETWEEN 0 AND 99),
  candidate_selected BOOLEAN NOT NULL DEFAULT FALSE,

  active_verdict VARCHAR(32) NOT NULL,
  candidate_verdict VARCHAR(32) NOT NULL,
  active_confidence REAL,
  candidate_confidence REAL,

  active_failed_metrics JSONB NOT NULL DEFAULT '[]'::jsonb,
  candidate_failed_metrics JSONB NOT NULL DEFAULT '[]'::jsonb,
  active_details JSONB NOT NULL DEFAULT '[]'::jsonb,
  candidate_details JSONB NOT NULL DEFAULT '[]'::jsonb,

  verdict_mismatch BOOLEAN NOT NULL,
  criticality_mismatch BOOLEAN NOT NULL,
  mismatch_reason JSONB NOT NULL DEFAULT '[]'::jsonb,

  decision_source VARCHAR(32) NOT NULL CHECK (decision_source IN ('active', 'candidate')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE (deployment_id, active_version, candidate_version, mode)
);

CREATE INDEX idx_aec_created_at
  ON analysis_engine_comparisons (created_at DESC);

CREATE INDEX idx_aec_project_created_at
  ON analysis_engine_comparisons (project_id, created_at DESC);

CREATE INDEX idx_aec_mismatch_created_at
  ON analysis_engine_comparisons (verdict_mismatch, criticality_mismatch, created_at DESC);
```

### Politique de rétention
- Conserver 90 jours minimum.
- Purge planifiée au-delà (job scheduler).
- Ne jamais purger avant fin d'un cycle de validation moteur.

## Contrat de persistance
Le verdict officiel (`deployment_verdicts`) reste idempotent par `deployment_id`.

La table `analysis_engine_comparisons`:
- doit être alimentée à chaque exécution candidate,
- peut être insérée dans la même transaction que l'analyse,
- ne doit jamais bloquer la persistance du verdict officiel si échec non critique de log:
  - fallback minimum: log structuré avec erreur explicite,
  - alerte SRE si taux d'échec d'insertion > 0.

## Workflow de rollout

## Phase 0 - Préparation
Checklist:
- [ ] `compute_verdict(...)` extrait en fonction pure (sans effets de bord DB).
- [ ] Active et candidate utilisent exactement les mêmes inputs `pre/post`.
- [ ] Table `analysis_engine_comparisons` déployée.
- [ ] Dashboards mismatch prêts.
- [ ] Alertes mismatch prêtes.

## Phase 1 - Shadow (canary 0%)
Configuration:
- `ANALYSIS_SHADOW_ENABLED=true`
- `ANALYSIS_CANARY_PERCENT=0`

Comportement attendu:
- verdict officiel toujours produit par `active`.
- candidate calculé et comparé.
- comparaison persistée en table dédiée.

Durée recommandée:
- minimum 7 jours ou volume statistique suffisant.

## Phase 2 - Canary progressif
Progression recommandée:
1. 1%
2. 5%
3. 20%
4. 50%
5. 100%

Règles:
- promotion uniquement si gates validées sur la phase en cours,
- rollback immédiat à l'étape précédente en cas de dérive.

## Gates de promotion (go/no-go)
Définir des seuils chiffrés avant la phase.

Exemple de gates:
- `verdict_mismatch_rate < 2%`
- `criticality_mismatch_rate = 0%` (ou seuil très proche de 0)
- aucune hausse significative des incidents `false_rollback_proxy` / `missed_critical_proxy`
- pas de dégradation KPI métier.

## Requêtes SQL de contrôle

Taux de mismatch global (24h):
```sql
SELECT
  COUNT(*) AS total,
  SUM(CASE WHEN verdict_mismatch THEN 1 ELSE 0 END) AS mismatch_count,
  ROUND(100.0 * SUM(CASE WHEN verdict_mismatch THEN 1 ELSE 0 END) / NULLIF(COUNT(*), 0), 2) AS mismatch_rate_pct
FROM analysis_engine_comparisons
WHERE created_at >= now() - interval '24 hours';
```

Mismatch critique (24h):
```sql
SELECT
  COUNT(*) AS total,
  SUM(CASE WHEN criticality_mismatch THEN 1 ELSE 0 END) AS criticality_mismatch_count
FROM analysis_engine_comparisons
WHERE created_at >= now() - interval '24 hours';
```

Top causes:
```sql
SELECT
  jsonb_array_elements_text(mismatch_reason) AS reason,
  COUNT(*) AS n
FROM analysis_engine_comparisons
WHERE created_at >= now() - interval '24 hours'
  AND (verdict_mismatch OR criticality_mismatch)
GROUP BY 1
ORDER BY n DESC;
```

## Observabilité (Prometheus)
Ajouter des métriques dédiées:
- `seqpulse_analysis_shadow_total{active_version,candidate_version,mode}`
- `seqpulse_analysis_shadow_mismatch_total{type}` avec `type in (verdict,criticality,metrics)`
- `seqpulse_analysis_shadow_decision_total{source}` avec `source in (active,candidate)`

Alertes recommandées:
- mismatch critique > 0 sur 15 min,
- mismatch global au-dessus du seuil de gate,
- insertion table comparaison en échec.

## Règles anti-régression
- Ne jamais envoyer notifications basées sur candidate en mode shadow.
- En canary, le `decision_source` doit être persisté (`active` ou `candidate`) pour audit.
- Ne jamais changer simultanément:
  - logique moteur,
  - mapping de verdict,
  - format des notifications.

## Stratégie de rollback
Rollback immédiat possible par config:
- `ANALYSIS_CANARY_PERCENT=0`
- `ANALYSIS_ACTIVE_VERSION="v1"`

Procédure:
1. Ramener canary à 0%.
2. Vérifier que `decision_source='active'` sur les nouveaux enregistrements.
3. Surveiller 15 min.
4. Ouvrir un postmortem technique si gate violée.

## Plan de tests minimum
- unit tests sur `compute_verdict` pour active et candidate.
- test d'intégration `shadow`: verdict officiel inchangé + ligne de comparaison créée.
- test d'intégration `canary`: `decision_source` cohérent avec bucket.
- test de non-régression notifications.
- test idempotence verdict officiel.

## Definition of Done (DoD)
Le rollout d'un nouveau moteur est "propre" si:
- [ ] table dédiée en place et alimentée à 100% des exécutions candidate.
- [ ] dashboards + alertes opérationnels.
- [ ] phase shadow validée selon gates.
- [ ] progression canary validée étape par étape.
- [ ] rollback testé et documenté.
- [ ] décision finale de promotion tracée (date, version, responsable).

## Template de décision de promotion
```text
Engine candidate: v2
Window analyzed: 2026-03-01 -> 2026-03-08
Shadow mismatch global: X%
Shadow mismatch critique: Y%
Canary levels completed: 1% / 5% / 20% / 50%
Incidents linked: N
Decision: GO|NO-GO
Owner: <name>
Date: <YYYY-MM-DD>
```
