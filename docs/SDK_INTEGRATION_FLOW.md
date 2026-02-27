# SDK Integration Flow (Source of Truth)

## Objectif

Documenter le flux produit validé pour l'intégration SDK SeqPulse afin de garder une ligne claire:

- SDK = metrics + sécurité HMAC
- CI/CD = hors scope SDK

Ce document sert de référence pour le frontend, le backend et la doc.

## Scope produit

Le SDK couvre uniquement:

- l'installation (`npm`, `pnpm`, `pip`)
- l'instrumentation metrics côté application
- l'exposition de l'endpoint metrics
- la validation HMAC optionnelle

Le SDK ne couvre pas:

- le déclenchement de pipeline CI/CD
- la logique `trigger/finish` côté intégration dev

## Flux validé

1. Le dev crée un projet depuis le frontend.
2. Dans le formulaire de création, il renseigne son `metrics_endpoint`.
3. Le projet est créé avec endpoint candidat.
4. Le dev teste l'endpoint via le mécanisme actuel (`Run Test & Activate`).
5. Une fois activé, l'UI affiche des snippets SDK pour finaliser l'intégration applicative.

## Règles snippets (obligatoires)

### 1) Snippet installation SDK

Afficher:

```bash
npm install seqpulse
# ou
pnpm add seqpulse
# ou
pip install seqpulse
```

### 2) Snippet usage SDK

Le snippet ne doit pas demander au dev de re-saisir l'endpoint.

Il doit injecter automatiquement l'endpoint du projet:

- priorité: `active_endpoint`
- fallback: `candidate_endpoint`

Important:

- si le SDK attend un path, extraire le path depuis l'URL du projet (`/ds-metrics`, etc.)
- si le SDK attend une URL complète, utiliser l'URL projet telle quelle

### 3) Snippet variables d'environnement (recommandé: OUI)

Ajouter un snippet dédié variables d'env pour guider les bonnes pratiques et réduire les erreurs d'intégration.

Exemple:

```bash
SEQPULSE_API_KEY=sp_xxx
SEQPULSE_METRICS_ENDPOINT=https://api.example.com/ds-metrics
SEQPULSE_HMAC_ENABLED=true
SEQPULSE_HMAC_SECRET=hmac_xxx
```

## Exigences UX

- Ne pas mélanger SDK et CI/CD dans les snippets SDK.
- Le texte doit explicitement dire que le SDK sert à exposer/normaliser/sécuriser les metrics.
- Montrer un état endpoint clair (`pending_verification`, `active`, `blocked`).
- Si endpoint non actif, afficher l'action `Run Test & Activate` avant de pousser l'intégration SDK.

## Critères d'acceptation

1. Après création projet + test endpoint, le dev peut copier-coller un snippet SDK fonctionnel sans retaper l'endpoint.
2. L'UI fournit un snippet variables d'environnement.
3. Aucun snippet SDK ne parle de pipeline CI/CD.
4. Le flux reste compatible avec le système actuel d'activation endpoint.

## Décision produit

Décision validée: conserver le flow backend/frontend actuel d'endpoint lock et test, puis enrichir la section intégration avec:

- snippet installation SDK
- snippet usage SDK prérempli avec endpoint projet
- snippet variables d'environnement

Sans introduire de logique pipeline dans la partie SDK.
