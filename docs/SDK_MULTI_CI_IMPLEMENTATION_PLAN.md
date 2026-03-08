# SDK Multi-CI Implementation Plan (Team Guide)

## 1) Reponse courte a la question critique

**Non, cette implementation n'ecrase pas le SDK runtime actuel.**

Ce qui reste inchangé:

- l'integration SDK dans l'application du dev (`npm install seqpulse`, `pip install seqpulse`)
- l'endpoint metrics expose par l'app (`/seqpulse-metrics` ou equivalent)
- la logique HMAC du endpoint metrics
- la collecte des metrics par SeqPulse via `SEQPULSE_METRICS_ENDPOINT`

Ce qui evolue:

- la standardisation de la couche **CI/CD** (`/deployments/trigger`, `/deployments/finish`)
- la facon d'orchestrer les appels en pipeline (SDK-first, wrappers GitHub en option)

---

## 2) Contexte et objectif

Nous voulons:

1. une integration **portable** sur n'importe quelle CI/CD (GitHub Actions, GitLab CI, CircleCI, Jenkins, etc.)
2. une integration **coherente** avec les SDK Node/Python existants
3. une experience DevOps plus propre (moins de scripts shell fragiles)

Objectif cible:

- **SDK-first** comme contrat officiel multi-plateforme
- **GitHub Action** et **Reusable Workflow** comme accelerateurs GitHub (optionnels)

---

## 3) Architecture cible (3 couches)

## Couche A - Runtime SDK (application)

Role:

- instrumenter et exposer l'endpoint metrics de l'application
- garantir format de payload et compatibilite HMAC

Scope:

- code applicatif du dev
- endpoint `/seqpulse-metrics`

Statut:

- deja en place, **non modifie** par ce plan

## Couche B - Integration CI universelle

Role:

- orchestrer `trigger` avant deploy
- orchestrer `finish` apres deploy
- transmettre `metrics_endpoint`, `idempotency_key`, `result`

Implementation cible:

- via SDK Node/Python (ou CLI officielle plus tard)

## Couche C - Wrappers GitHub (option)

Role:

- simplifier les repos GitHub

Implementation:

- Action GitHub `seqpulse/...@v1`
- Reusable workflow `workflow_call` pour org multi-repos

---

## 4) Contrat d'integration CI (v1)

Params minimaux:

- `env` (ex: `prod`)
- `metrics_endpoint` (URL publique que SeqPulse peut appeler)
- `idempotency_key` (unique par run CI)
- `branch` (optionnel mais recommande)
- `result` (`success` ou `failed` au finish)

Regles:

1. `trigger` se fait avant le deploy effectif
2. `finish` se fait en `always()` / post stage (meme si deploy echoue)
3. mode par defaut: **non-bloquant** (warning, pas de fail pipeline)
4. timeouts courts et explicites
5. idempotency obligatoire pour eviter doublons

---

## 5) Cas concrets (illustrations)

## Cas 1 - GitHub Actions, deploy reussi

Flux:

1. trigger retourne `deployment_id=abc`
2. deploy Vercel/K8s reussi
3. finish envoie `result=success`
4. SeqPulse planifie/execute collecte POST + analyse

Resultat attendu:

- deployment visible dans dashboard
- verdict final calcule (`ok`, `warning`, ou `rollback_recommended`)

## Cas 2 - GitLab CI, deploy echoue

Flux:

1. trigger cree deployment
2. stage deploy echoue
3. stage post-job appelle finish avec `result=failed`

Resultat attendu:

- deployment n'est pas perdu
- contexte d'echec conserve pour analyse

## Cas 3 - SeqPulse temporairement indisponible

Flux:

1. trigger timeout HTTP
2. pipeline continue (non-bloquant)
3. warning visible dans logs CI

Resultat attendu:

- pas de blocage release
- observabilite claire (raison du skip)

## Cas 4 - Retry manuel du meme pipeline

Flux:

1. meme `idempotency_key`
2. trigger retourne `existing`

Resultat attendu:

- pas de doublon deployment
- comportement deterministe

## Cas 5 - Endpoint runtime deja en prod, migration CI

Flux:

1. on ne touche pas au code SDK runtime
2. on migre seulement la couche CI `trigger/finish`

Resultat attendu:

- endpoint `/seqpulse-metrics` inchangé
- zero impact applicatif

---

## 6) Plan d'execution equipe

## Phase 0 - Alignement (0.5 jour)

Livrables:

- contrat CI v1 valide (params, statuts, erreurs)
- decision officielle: SDK-first + wrappers GitHub optionnels

## Phase 1 - Snippets SDK multi-CI (1-2 jours)

Livrables:

- snippets officiels Node/Python:
- GitHub Actions
- GitLab CI
- CircleCI
- Jenkins

Definition of Done:

- chaque snippet passe les 5 cas concrets ci-dessus

## Phase 2 - Wrapper GitHub Action (1 jour)

Livrables:

- action `v1` avec inputs/outputs documentes
- sortie claire: `deployment_id`, `status`, `http_status`

## Phase 3 - Reusable Workflow GitHub (0.5-1 jour)

Livrables:

- workflow central `workflow_call`
- adoption sur repos pilotes

## Phase 4 - Validation & rollout (1 jour)

Livrables:

- checklist de validation cross-CI
- dashboard de suivi adoption (repos migrés / non migrés)

---

## 7) Checklist de validation (pre-prod)

1. trigger fonctionne avec endpoint runtime actuel
2. finish tourne meme en cas d'echec deploy
3. idempotency testee (pas de doublons)
4. timeout/retry conformes a la policy
5. secrets scopes correctement (CI only)
6. logs CI explicites (cause de warning)
7. verdict visible en dashboard

---

## 8) Risques et mitigations

Risque:
Documents/Workflow/packages/

- confusion entre secrets CI et variables runtime app

Mitigation:

- blocs de variables strictement separes dans doc

Risque:

- derive de comportement entre plateformes CI

Mitigation:

- contrat CI v1 unique + snippets SDK officiels

Risque:

- blocage release si SeqPulse down

Mitigation:

- mode non-bloquant par defaut, mode strict optionnel

---

## 9) Decision finale recommandee

1. garder le SDK runtime actuel intact (`/seqpulse-metrics`)
2. officialiser SDK-first pour la couche CI trigger/finish
3. proposer GitHub Action et Reusable Workflow comme options de confort GitHub

Cette approche preserve l'existant, minimise le risque, et reste compatible avec toutes les CI/CD.

---

## 10) Suivi implementation (etat)

- Etape 1 - SDK Node: client CI `trigger/finish` ajoute (`createCIClient`, `triggerDeployment`, `finishDeployment`) -> **OK**
- Etape 2 - SDK Node: types TypeScript (`index.d.ts`) mis a jour pour API CI -> **OK**
- Etape 3 - SDK Node: smoke test etendu pour couvrir trigger/finish (transport mock) -> **OK**
- Etape 4 - SDK Python: module `seqpulse/ci.py` ajoute (`SeqPulseCIClient`, helpers) -> **OK**
- Etape 5 - SDK Python: exports publics mis a jour dans `seqpulse/__init__.py` -> **OK**
- Etape 6 - SDK Python: smoke test etendu pour couvrir trigger/finish (transport mock) -> **OK**
- Etape 7 - Documentation SDK Node mise a jour (runtime + CI, note compatibilite) -> **OK**
- Etape 8 - Documentation SDK Python mise a jour (runtime + CI, note compatibilite) -> **OK**
- Etape 9 - Validation smoke Node (`npm run smoke`) -> **OK**
- Etape 10 - Validation smoke Python (`python3 scripts/smoke.py`) -> **OK**
- Etape 11 - Retrait de l'exposition `windowSeconds/window_seconds` dans les SDK endpoint (Node/Python) -> **OK**
- Etape 12 - Regeneration artefact Node (`npm pack` -> `seqpulse-0.2.0.tgz`) -> **OK**
- Etape 13 - Regeneration artefacts Python (`python -m build` -> wheel + sdist) -> **OK**
