# SEQPULSE - Etapes d'Implementation des Lifecycle Emails MVP

Derniere mise a jour: 19 fevrier 2026

## Objectif

Implementer les lifecycle emails MVP definis dans `docs/EMAIL_LIFECYCLE_MVP.md`:

1. E-TRX-01 (Welcome signup)
2. E-ACT-01 (No project after 2h)
3. E-ACT-04 (First verdict available)
4. E-ACT-05 (Critical verdict alert)
5. E-CONV-01 (80% quota free)
6. E-CONV-03 (quota reached)

## Resultat attendu du MVP

1. Les 6 emails critiques sont envoyes automatiquement.
2. Les envois sont deduplices (pas de doublons).
3. Les jobs email sont resilients (scheduler persistant existant).
4. Les KPI MVP peuvent etre mesures chaque semaine.

## Etape 0 - Cadrage technique (1/2 jour)

### A faire
1. Valider le provider email MVP (`Resend` recommande).
2. Valider l'adresse expediteur (`EMAIL_FROM`).
3. Valider les URLs CTA frontend (dashboard, pricing, onboarding).

### Fichiers
1. `backend/app/core/settings.py`
2. `README.md`

### Critere de validation
1. Les variables d'env email existent et sont documentees.
2. L'environnement local peut charger la config sans erreur.

## Etape 1 - Fondations data + dedupe (1 jour)

### A faire
1. Creer la table `email_deliveries` (journal d'envoi + dedupe key unique).
2. Ajouter les index necessaires (`user_id`, `project_id`, `email_type`, `created_at`).
3. Permettre les jobs scheduler sans `deployment_id` (necessaire pour signup/no-project).

### Fichiers
1. `backend/migrations/versions/<new>_add_email_deliveries_and_email_jobs.py`
2. `backend/app/db/models/scheduled_job.py`
3. `backend/app/db/models/__init__.py`
4. `backend/app/main.py` (import model si necessaire)

### Critere de validation
1. `alembic upgrade head` passe sans erreur.
2. La contrainte unique `dedupe_key` empeche un second insert identique.
3. Les jobs `scheduled_jobs` peuvent exister sans `deployment_id`.

## Etape 2 - Module email MVP (1 jour)

### A faire
1. Creer un module `app/email/` avec:
   - types d'emails MVP (`E-TRX-01`, `E-ACT-01`, `E-ACT-04`, `E-ACT-05`, `E-CONV-01`, `E-CONV-03`)
   - builder de payload template
   - service d'envoi provider (MVP: Resend/Postmark)
2. Implementer `send_email_if_not_sent(dedupe_key, ...)`.
3. Implementer le throttling minimal: max 1 email marketing/24h (hors transactionnel/critique).

### Fichiers
1. `backend/app/email/types.py` (nouveau)
2. `backend/app/email/templates.py` (nouveau)
3. `backend/app/email/service.py` (nouveau)
4. `backend/app/core/settings.py` (vars provider)

### Critere de validation
1. Un email test peut etre envoye en local/dev.
2. Un meme `dedupe_key` ne part qu'une seule fois.
3. Le throttling marketing bloque correctement un second envoi < 24h.

## Etape 3 - Execution scheduler `email_send` (1 jour)

### A faire
1. Ajouter `job_type="email_send"` dans le flux scheduler.
2. Ajouter helper `schedule_email(...)` dans `app/scheduler/tasks.py`.
3. Ajouter execution `email_send` dans `JobPoller` avec retries existants.

### Fichiers
1. `backend/app/scheduler/tasks.py`
2. `backend/app/scheduler/poller.py`
3. `backend/tests/test_scheduler.py`

### Critere de validation
1. Un job `email_send` passe `pending -> running -> completed`.
2. En cas d'erreur provider, le retry/backoff du poller fonctionne.

## Etape 4 - Triggers Activation (signup -> aha) (1 jour)

### A faire
1. Sur signup reussi:
   - scheduler E-TRX-01 immediat
   - scheduler E-ACT-01 a +2h
2. Implementer la garde no-project au moment de l'execution E-ACT-01.
3. Sur premier verdict cree:
   - envoyer E-ACT-04
4. Si verdict critique (`warning` ou `rollback_recommended`):
   - envoyer E-ACT-05

### Fichiers
1. `backend/app/auth/routes.py`
2. `backend/app/analysis/engine.py`
3. `backend/app/email/service.py`
4. `backend/tests/test_analysis.py`
5. `backend/tests/test_twofa_api.py` (ou nouveau test auth lifecycle)

### Critere de validation
1. Signup cree bien 2 jobs emails attendus.
2. E-ACT-01 n'est pas envoye si un projet a ete cree avant +2h.
3. Premier verdict declenche E-ACT-04 une seule fois.
4. Verdict critique declenche E-ACT-05.

## Etape 5 - Triggers Conversion Free (1 a 1.5 jour)

### A faire
1. Implementer compteur mensuel des deployments par projet free.
2. Declencher E-CONV-01 des que quota >= 40/50 (dedupe mensuelle).
3. Bloquer trigger deployment au dela du quota free (>= 50) avec reponse 402.
4. Au blocage quota, envoyer E-CONV-03 immediat.

### Fichiers
1. `backend/app/deployments/services.py`
2. `backend/app/deployments/routes.py` (si header/infos supplementaires)
3. `backend/app/email/service.py`
4. `backend/tests/test_hmac.py` (si impact flux trigger)
5. `backend/tests/test_scheduler.py` (si usage scheduler)
6. `backend/tests/test_deployments_lifecycle.py` (nouveau recommande)

### Critere de validation
1. Projet free avec 39 deployments: trigger accepte.
2. Projet free a 40: E-CONV-01 planifie/envoye.
3. Projet free a 50: nouveau trigger refuse avec 402.
4. Refus quota envoie E-CONV-03.

## Etape 6 - Templates email MVP (0.5 jour)

### A faire
1. Ecrire les 6 templates texte/HTML.
2. Uniformiser sujets + CTA.
3. Ajouter fallback si donnee manquante (project name, deployment number, etc.).

### Fichiers
1. `backend/app/email/templates.py`
2. `docs/EMAIL_LIFECYCLE_MVP.md` (ajustement wording si besoin)

### Critere de validation
1. Chaque template compile sans variable manquante.
2. Les CTAs pointent vers les bonnes pages frontend.

## Etape 7 - Tests, verification et readiness (1 jour)

### A faire
1. Ajouter tests unitaires pour dedupe et throttle.
2. Ajouter tests integration des 6 triggers MVP.
3. Ajouter test non-regression scheduler pour `email_send`.
4. Executer la suite backend complete.

### Commandes de verification
1. `cd backend && source .venv/bin/activate && pytest -q`
2. `cd backend && alembic upgrade head` (en env de test/integration)

### Critere de validation
1. Tous les tests passent.
2. Aucun doublon d'email dans `email_deliveries`.
3. Les retries scheduler fonctionnent en cas d'echec provider simule.

## Etape 8 - Rollout progressif (0.5 jour)

### A faire
1. Activer d'abord E-TRX-01, E-ACT-01, E-ACT-04.
2. Activer ensuite E-ACT-05.
3. Activer enfin E-CONV-01 et E-CONV-03.
4. Monitorer pendant 7 jours les KPI MVP.

### Parametre rollout
1. Variable backend: `EMAIL_ENABLED_TYPES` (liste CSV).
2. Valeur vide: tous les types MVP actifs.
3. Exemple phase 1:
   `EMAIL_ENABLED_TYPES=E-TRX-01,E-ACT-01,E-ACT-04`
4. Exemple phase 2:
   `EMAIL_ENABLED_TYPES=E-TRX-01,E-ACT-01,E-ACT-04,E-ACT-05`
5. Exemple phase 3:
   `EMAIL_ENABLED_TYPES=E-TRX-01,E-ACT-01,E-ACT-04,E-ACT-05,E-CONV-01,E-CONV-03`

### KPI MVP a monitorer
1. `signup_to_project_24h`
2. `project_to_first_verdict_72h`
3. `free_to_pro_from_quota_emails`
4. `critical_alert_open_rate`

### Critere de validation
1. Aucun incident de production lie au scheduler email.
2. Taux de delivrabilite acceptable.
3. KPI disponibles dans un rapport hebdo.

## Ordre d'execution recommande (critical path)

1. Etape 1 -> Etape 2 -> Etape 3 (socle technique).
2. Etape 4 (activation produit).
3. Etape 5 (conversion quota).
4. Etape 6 -> Etape 7 -> Etape 8.

## Definition de done (MVP lifecycle emails)

1. Les 6 scenarios MVP sont implementes et testes.
2. Les envois sont deduplices et observables.
3. Le quota Free est applique (incluant l'email de blocage).
4. L'equipe peut suivre les 4 KPI MVP en routine hebdomadaire.
