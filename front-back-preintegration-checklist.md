# Front/Back Pre-Integration Checklist

Date: 2026-02-14 (mise à jour: 2026-02-16)
Objectif: verrouiller les points de conformité avant de brancher le frontend sur les endpoints backend.

## 1) Bloquants (à corriger en premier)

- [x] Ajouter les endpoints de lecture manquants pour alimenter le dashboard.
  - Référence: `backend/app/projects/routes.py:48` (`GET /projects/`)
  - Référence: `backend/app/projects/routes.py:83` (`GET /projects/{project_id}`)
  - Référence: `backend/app/deployments/routes.py:33` (`GET /deployments/`)
  - Référence: `backend/app/deployments/routes.py:52` (`GET /deployments/{deployment_id}`)
  - Référence: `backend/app/deployments/routes.py:70` (`GET /deployments/{deployment_id}/metrics`)
  - Référence: `backend/app/sdh/routes.py:19` (`GET /sdh/`)
  - Action: endpoints exposés avec une shape compatible dashboard frontend.
  - Note: mapping temporaire retiré; les endpoints dashboard exposent désormais les enums backend natifs pour `state` et `pipeline_result`.

- [x] Corriger la configuration CORS pour le front local standard.
  - Référence: `backend/app/main.py:36`
  - Référence: `frontend/README.md:17`
  - Action: `http://localhost:3000` ajouté explicitement.

- [x] Aligner le contrat d’identifiants et de payloads (UUID interne, IDs publics frontend).
  - Référence: `backend/app/db/models/project.py:15` (`project_number`)
  - Référence: `backend/app/db/models/deployment.py:34` (`deployment_number`)
  - Référence: `backend/app/core/public_ids.py:1` (format/parse `prj_`/`dpl_`)
  - Référence: `backend/app/projects/routes.py:83` (lookup projet par ID public ou UUID)
  - Référence: `backend/app/deployments/routes.py:52` (lookup déploiement par ID public ou UUID)
  - Référence: `backend/migrations/versions/9f31d2ab7c11_add_public_numbers_for_projects_and_.py:1` (migration)
  - Référence: `frontend/app/dashboard/projects-data.json:3`
  - Référence: `frontend/app/dashboard/deployments-data.json:3`
  - Action: mapping backend en IDs publics (`id: prj_<n>`, `id: dpl_<n>`) pour les endpoints dashboard.
  - Action: migration DB requise avant déploiement applicatif (`alembic upgrade head`).

- [x] Aligner les enums métier entre front et back.
  - Référence: `backend/app/deployments/schemas.py:24`
  - Référence: `backend/app/db/models/deployment.py:50`
  - Référence: `backend/app/analysis/engine.py:102`
  - Référence: `frontend/app/dashboard/deployments/page.tsx:60`
  - Référence: `frontend/components/chart-area-interactive.tsx:73`
  - Action: nomenclature unique figée:
    - `state`: `pending` | `running` | `finished` | `analyzed` (frontend aligné backend)
    - `pipeline_result`: `success` | `failed` (frontend aligné backend)
    - `verdict`: `ok` | `warning` | `rollback_recommended` (backend aligné sur `warning`)

- [x] Brancher l’auth frontend sur l’auth backend.
  - Référence: `backend/app/auth/deps.py:10`
  - Référence: `backend/app/auth/routes.py:39`
  - Référence: `frontend/components/login-form.tsx:25`
  - Référence: `frontend/components/signup-form.tsx:25`
  - Action: login/signup réels + stockage token + envoi `Authorization: Bearer ...` sur routes protégées (`/auth/me`) + garde d’accès dashboard.

## 2) Importants (juste après les bloquants)

- [x] Aligner le flux de création projet.
  - Référence: `frontend/app/dashboard/projects/new/page.tsx:81`
  - Référence: `frontend/app/dashboard/projects/new/page.tsx:97`
  - Référence: `backend/app/projects/schemas.py:5`
  - Action: frontend aligné backend sur la création:
    - payload `envs: [env]` (au lieu de `env`)
    - payload `tech_stack` (au lieu de `stack`)
    - suppression de `metrics_endpoint` et `plan` du flux de création (non supportés par `POST /projects`)

- [x] Remplacer les sources JSON mock par un client API centralisé.
  - Référence: `frontend/app/dashboard/page.tsx:6`
  - Référence: `frontend/app/dashboard/projects/page.tsx:14`
  - Référence: `frontend/app/dashboard/deployments/page.tsx:51`
  - Référence: `frontend/app/dashboard/SDH/page.tsx:13`
  - Action: couche API centralisée mise en place (`api-client` + `dashboard-client`) et branchement des vues dashboard/projets/déploiements/SDH sur API réelle.

- [x] Aligner l’UX HMAC/API key avec le comportement réel backend.
  - Référence: `backend/app/projects/routes.py:38`
  - Référence: `frontend/app/dashboard/projects/[projectId]/page.tsx:500`
  - Action: activation/rotation/désactivation HMAC via API + affichage secret one-shot.
  - Action: ajout d’un endpoint de lecture credentials projet (`GET /projects/{project_id}/public`) pour récupérer `api_key`/`hmac_enabled` sans effet de bord.
  - Action: affichage des clés entièrement masqué (`*`) et copie des vraies valeurs.

- [x] Nettoyer les erreurs lint TypeScript/React avant intégration finale.
  - Exemples: hooks conditionnels, `any`, règles React hooks.
  - Référence: `frontend/app/dashboard/projects/[projectId]/page.tsx:535`
  - Référence: `frontend/components/site-header.tsx:16`
  - Référence: `frontend/components/theme-toggle.tsx:49`
  - Action: `pnpm -C frontend lint` passe sans erreur (0 error, warnings non bloquants).

## 3) Vérifications minimales avant connexion réelle

- [x] Front: `pnpm -C frontend lint` -> 0 erreur.
- [x] Backend: tests unitaires API/domaines verts (hors scripts dépendant d’un serveur externe).
  - Vérifié le 2026-02-16: `backend/.venv/bin/pytest -q backend/tests` -> `21 passed`.
- [x] Smoke test API:
  - signup -> login -> token reçu
  - create project -> trigger deployment -> finish deployment
  - list sdh / list deployments / list projects (endpoints de lecture)
  - Validé manuellement le 2026-02-16.
- [x] Vérifier CORS en local:
  - Front: `http://localhost:3000`
  - Back: `http://localhost:8000`
  - Validé manuellement le 2026-02-16.

## 4) Règle d’avancement "safe"

Ne pas brancher l’UI écran par écran tant que:
- les enums ne sont pas figés,
- les DTO ne sont pas figés,
- l’auth n’est pas fonctionnelle de bout en bout,
- les endpoints de lecture ne sont pas disponibles.

## 5) Definition of Done (pré-liaison validée)

- [ ] Contrat API documenté et stable.
- [x] Front branché sur API réelle (plus de JSON mock pour les vues critiques).
- [x] Auth complète (signup/login/me + token bearer).
- [x] CORS validé en local.
- [x] Lint front sans erreur.
- [ ] Parcours fonctionnel E2E manuel validé.

## 6) Journal des changements

  - 2026-02-14:
  - Endpoints de lecture dashboard ajoutés (projects/deployments/metrics).
  - CORS local frontend aligné (`http://localhost:3000`).
  - IDs publics ajoutés pour le frontend (`prj_<n>`, `dpl_<n>`), UUID conservés en interne.
  - Enums métier alignés front/back (`state`, `pipeline_result`) et verdict backend migré vers `warning` (compatibilité legacy `attention` en lecture).
  - Auth frontend branchée au backend (signup/login réels, token local, `/auth/me`, redirection dashboard, logout).
  - Flux création projet frontend aligné backend (`POST /projects` avec `name`, `description`, `tech_stack`, `envs`).
  - Sources JSON mock remplacées dans les vues dashboard/projets/déploiements par un client API centralisé.
  - Erreurs lint front bloquantes corrigées; `pnpm -C frontend lint` passe avec 0 erreur.
  - 2026-02-16:
  - Vue SDH branchée sur API backend (`GET /sdh/`) via `dashboard-client`; suppression du mock `sdh-data.json` dans la page SDH.
  - Vérification tests backend unitaires: `backend/.venv/bin/pytest -q backend/tests` -> `21 passed` (hors scripts nécessitant un serveur HTTP actif).
  - Smoke test API validé manuellement (signup/login, token, create project, trigger/finish deployment, lectures projects/deployments/sdh).
  - CORS validé en local (`http://localhost:3000` -> `http://localhost:8000`).
  - Auth complète validée manuellement côté frontend/backend (signup/login/me + bearer token).
