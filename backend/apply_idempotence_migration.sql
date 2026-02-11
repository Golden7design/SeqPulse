-- Migration manuelle pour l'idempotence v2
-- À exécuter si Alembic a des problèmes de multiple heads
-- Date: 2026-02-10

-- 1. Supprimer l'ancienne idempotence commit_sha
ALTER TABLE deployments
  DROP CONSTRAINT IF EXISTS uq_deployments_project_env_commit;

DROP INDEX IF EXISTS ix_deployments_commit_sha;

ALTER TABLE deployments
  DROP COLUMN IF EXISTS commit_sha;

-- 2. Ajouter la nouvelle clé d'idempotence
ALTER TABLE deployments
  ADD COLUMN IF NOT EXISTS idempotency_key VARCHAR(255);

-- 3. Un seul deployment running par projet/env
CREATE UNIQUE INDEX IF NOT EXISTS uq_running_deployment
  ON deployments(project_id, env)
  WHERE state = 'running';

-- 4. Idempotency-Key unique (optionnel)
CREATE UNIQUE INDEX IF NOT EXISTS uq_deployments_idempotency_key
  ON deployments(idempotency_key)
  WHERE idempotency_key IS NOT NULL;

-- 5. Empêcher doublons de métriques
CREATE UNIQUE INDEX IF NOT EXISTS uq_metric_sample
  ON metric_samples(deployment_id, phase, collected_at);

-- 6. Vérifier
\d deployments
\d metric_samples
