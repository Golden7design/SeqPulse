# Project Endpoint Lock Design and Implementation Plan

Date: 2026-02-24  
Status: Brainstorming finalise, pret pour implementation  
Scope: Backend + Frontend (projets/deployments/settings)

## 1) Contexte et objectif

SeqPulse doit garder la regle metier:

- **1 projet = 1 app**

Probleme constate:

- Si l'endpoint metrics est librement modifiable, un client peut reutiliser un seul projet payant pour monitorer plusieurs apps.

Objectif du design:

- Preserver une UX simple au onboarding.
- Bloquer le contournement business.
- Garder une migration realiste pour les integrateurs deja branches.

## 2) Resultat du brainstorming (verrouille)

### Decisions produit/techniques

1. Endpoint obligatoire a la creation de projet.
2. Activation reelle de l'endpoint uniquement apres test reussi.
3. Verrouillage sur **host exact** apres premier test valide.
4. Le **path** est modifiable sur le meme host.
5. Le host est compare **sans port**.
6. Migration de host autorisee via flow dedie, auto-validee par backend.
7. Quotas:
   - Free: 1
   - Pro: 3
   - Enterprise: illimite
8. Apres changement active: archive read-only + nouvelle baseline.
9. Actions sensibles reservees a owner/admin + re-auth recente.
10. Backend est la source de verite (anti-abus, quotas, etats).
11. Compatibilite transitoire: payload deployment peut encore contenir `metrics_endpoint`, mais doit matcher l'endpoint actif du projet.
12. Logs/observabilite: host visible, path masque a 2 segments max, jamais query string/secrets.

### Contraintes NFR retenues

- Charge cible 6 mois: `< 5k` projets actifs, `< 20k` tests endpoint/mois.
- SLA UX test endpoint: cible `p95 < 5s`, fallback async si timeout.
- Disponibilite: best effort (pas de SLO formel en V1).

### Non-objectifs explicites

- Pas de systeme fingerprint complexe en V1 (pas de variables d'env additionnelles imposees au client).
- Pas de heuristique anti-fraude avancee multi-signaux en V1.

## 3) Architecture cible (A + B)

### A) Core endpoint au niveau projet (recommande)

Le projet devient la source de verite pour l'endpoint metrics.

- Create project -> `pending_verification`
- Test reussi -> `active` + host lock fixe
- Changement endpoint -> `pending_verification` jusqu'a nouveau test OK

### B) Compatibilite CI transitoire

Les routes deployment continuent temporairement d'accepter `metrics_endpoint` dans le payload, mais:

- backend refuse si different de l'endpoint actif du projet (`409 ENDPOINT_MISMATCH`).

Cela permet une migration progressive des integrations CI/CD existantes.

## 4) Modele de donnees propose (projects)

Champs a ajouter dans `projects`:

- `metrics_endpoint_candidate` (string, obligatoire logique)
- `metrics_endpoint_active` (string, nullable tant que non active)
- `endpoint_state` (`pending_verification | active | blocked`)
- `endpoint_host_lock` (string, host normalise sans port)
- `endpoint_change_count` (int, default 0)
- `endpoint_migration_count` (int, default 0)
- `endpoint_last_verified_at` (datetime, nullable)
- `endpoint_last_test_error_code` (string, nullable)
- `baseline_version` (int, default 1)

Option recommandee:

- table `project_endpoint_events` pour audit append-only (qui, quoi, quand, resultat).

## 5) Contrat API propose

### Creation projet

- `POST /projects`
- Endpoint metrics obligatoire dans payload.
- Etat initial: `pending_verification`.

### Lecture config endpoint

- `GET /projects/{project_id}/endpoint`
- Retourne au minimum:
  - `state`
  - `candidate_endpoint_masked`
  - `active_endpoint_masked`
  - `host_lock`
  - `changes_used`, `changes_limit`
  - `migrations_used`, `migrations_limit`

### Mise a jour endpoint

- `PUT /projects/{project_id}/endpoint`
- Owner/admin + re-auth recente requise.
- Met a jour candidate uniquement.
- Passe en `pending_verification`.
- Ne jamais activer immediatement.

### Test endpoint

- `POST /projects/{project_id}/endpoint/test`
- Execution synchrone cible <5s; sinon fallback async (job + polling).
- Si test OK:
  - active candidate
  - update `endpoint_last_verified_at`
  - incremente compteur adequat
  - si changement post-activation: archive + `baseline_version += 1`

### Garde de compatibilite deployments

- `POST /deployments/trigger`
- `POST /deployments/finish`
- Si `metrics_endpoint` present dans payload et different de l'actif projet -> `409 ENDPOINT_MISMATCH`.

## 6) Regles metier detaillees

### Verrouillage host

- Au premier test valide, `endpoint_host_lock = normalize_host(active_endpoint)`.
- `normalize_host`:
  - lowercase
  - port ignore
  - host compare exact

### Changement path

- Autorise uniquement si host normalise identique.
- Consomme quota au moment de l'activation reussie.

### Migration host

- Candidate avec host different -> flow migration.
- Auto-validation backend si quota disponible selon plan.
- Activation finale conditionnee par test endpoint reussi.

### Quotas

- Free: 1
- Pro: 3
- Enterprise: illimite

Le compteur est consomme sur **activation validee**, pas sur tentative KO.

### Archivage

Apres tout changement active:

- snapshots historiques en lecture seule
- nouvelle baseline de comparaison
- `baseline_version` incremente

## 7) Erreurs metier standardisees

- `400 ENDPOINT_INVALID_FORMAT`
- `400 ENDPOINT_TEST_FAILED`
- `401 REAUTH_REQUIRED`
- `403 INSUFFICIENT_ROLE`
- `409 ENDPOINT_MISMATCH`
- `409 HOST_LOCK_VIOLATION`
- `409 CHANGE_LIMIT_EXCEEDED`
- `409 MIGRATION_LIMIT_EXCEEDED`
- `423 PROJECT_ENDPOINT_BLOCKED`

## 8) Securite et observabilite

### Securite

- Actions sensibles: owner/admin uniquement + re-auth recente.
- Validation stricte URL (schema, host, path).
- Query string ignoree pour comparaison et masquee en logs.

### Logs et audit

- Events:
  - `endpoint_candidate_updated`
  - `endpoint_test_succeeded`
  - `endpoint_test_failed`
  - `endpoint_activated`
  - `host_migration_auto_approved`
  - `host_migration_rejected`
- Masquage:
  - host visible
  - path max 2 segments
  - pas de query string
  - pas de secret/token

## 9) Plan d'implementation

## Phase 1 - Schema et backend core

1. Ajouter migration DB pour nouveaux champs projet.
2. Ajouter model/enum endpoint state.
3. Implementer service de normalisation host (sans port).
4. Implementer logique de quotas plan et compteurs.
5. Implementer archivage + increment baseline version.

Definition of Done:

- Migrations appliquees.
- Tests unitaires service endpoint verts.

## Phase 2 - API endpoint management

1. Ajouter routes:
   - `GET /projects/{id}/endpoint`
   - `PUT /projects/{id}/endpoint`
   - `POST /projects/{id}/endpoint/test`
2. Integrer controle role + re-auth.
3. Integrer test sync + fallback async.
4. Exposer erreurs metier standardisees.

Definition of Done:

- Contrat API stable et documente.
- Tests API (success + failure paths) verts.

## Phase 3 - Compatibilite deployments (B)

1. Ajouter garde `ENDPOINT_MISMATCH` sur trigger/finish.
2. Logger mismatch pour suivi migration clients.
3. Garder compat temporaire du champ payload.

Definition of Done:

- Aucun run n'utilise endpoint hors source de verite projet.

## Phase 4 - Frontend settings et onboarding

1. Creation projet: endpoint obligatoire.
2. Redirect settings apres creation.
3. UI endpoint state:
   - pending_verification
   - active
   - blocked
4. Bouton test endpoint + feedback sync/async.
5. UI quotas et compteur.
6. UI migration host dediee.

Definition of Done:

- Parcours UX complet et coherent avec backend.

## Phase 5 - Qualite, rollout, deprecation

1. Suite de tests end-to-end:
   - create -> test -> activate
   - path change same host
   - host migration
   - quota exceed
   - deployment mismatch reject
2. Monitoring des erreurs metier.
3. Plan de deprecation du `metrics_endpoint` dans payload deployments (apres migration clients).

Definition of Done:

- Taux d'erreur controle.
- Aucune regression sur flux deployment.

## 10) Criteres d'acceptation globaux

- Impossible de monitorer plusieurs apps avec un seul projet via switch endpoint libre.
- Onboarding reste simple (pas de variables d'env additionnelles imposees en V1).
- Changement endpoint legitime reste possible et guide.
- Historique preserve via archivage read-only.
- Regles appliquees exclusivement par backend.

## 11) Decision Log (consolide)

- D1: Verrouillage host exact apres 1er test OK.
- D2: Path libre sur meme host.
- D3: Activation uniquement apres test reussi.
- D4: Migration host auto-validee backend + quotas.
- D5: Archivage historique + nouvelle baseline.
- D6: Ownership anti-abus backend only.
- D7: Source de verite endpoint au niveau projet.
- D8: Compatibilite deployment payload avec garde mismatch.
- D9: API endpoint dediee (`GET/PUT/TEST`).
- D10: Quota consomme a activation reussie.
- D11: Owner/admin + re-auth recente pour actions sensibles.
- D12: Policy de masquage logs (host + 2 segments max).

