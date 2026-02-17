# OAuth GitHub dans SeqPulse

## Objectif
Ce document décrit:
- le fonctionnement OAuth GitHub actuellement implémenté dans SeqPulse;
- la logique de compte utilisateur (avec ou sans mot de passe local);
- les modifications a faire pour un passage en production.

## Vue d'ensemble
SeqPulse utilise un flux OAuth cote backend:
- le frontend declenche le demarrage OAuth;
- le backend redirige vers GitHub;
- GitHub appelle le callback backend;
- le backend cree/connecte l'utilisateur, genere un JWT SeqPulse;
- le backend redirige vers le frontend avec le token;
- le frontend finalise la session.

## Endpoints utilises
- `GET /auth/oauth/github/start?mode=login|signup`
- `GET /auth/oauth/github/callback`
- `GET /auth/me`
- `POST /auth/change-password`
- `POST /auth/set-password`

## Variables d'environnement
### Backend
- `FRONTEND_URL`
- `GITHUB_CLIENT_ID`
- `GITHUB_CLIENT_SECRET`
- `SECRET_KEY`
- `JWT_ALGORITHM`
- `JWT_ACCESS_TOKEN_EXPIRE_MINUTES`

### Frontend
- `NEXT_PUBLIC_BACKEND_URL`

## Flux detaille (pas a pas)
1. L'utilisateur clique sur `Login with GitHub` ou `Sign up with GitHub`.
2. Le frontend appelle `startOAuth("github", mode)` et navigue vers:
   - `${BACKEND_URL}/auth/oauth/github/start?mode=...`
3. Le backend:
   - verifie la config GitHub (`GITHUB_CLIENT_ID/SECRET`);
   - construit un `state` signe (JWT) avec provider + expiration;
   - redirige vers `https://github.com/login/oauth/authorize`.
4. Apres consentement, GitHub redirige vers:
   - `GET /auth/oauth/github/callback?code=...&state=...`
5. Le backend callback:
   - verifie `state`;
   - echange `code` contre `access_token` GitHub;
   - recupere profil + emails GitHub;
   - trouve l'utilisateur par email;
   - s'il n'existe pas, le cree;
   - genere un JWT SeqPulse;
   - redirige vers `${FRONTEND_URL}/auth/oauth-callback#access_token=...`.
6. Le frontend `/auth/oauth-callback`:
   - lit le token depuis le fragment URL (`#...`);
   - stocke le token (localStorage);
   - appelle `/auth/me`;
   - remplit le store utilisateur et redirige vers `/dashboard`.

## Comportement utilisateur (important)
### Utilisateur GitHub nouveau
Si aucun compte avec le meme email n'existe, le backend cree automatiquement l'utilisateur.

### Mot de passe pour compte OAuth
Il n'y a pas de champ `provider` ajoute au modele DB.

Pour un compte cree via OAuth GitHub:
- `hashed_password` recoit une valeur sentinel interne (`oauth_no_password$...`);
- cela signifie: "compte sans mot de passe local defini".

### Settings: changer ou definir mot de passe
- Si `has_password=true`: flow normal `change-password` (current + new).
- Si `has_password=false`: flow `set-password` (new password uniquement).

Endpoints:
- `POST /auth/change-password`: refuse si pas de mot de passe local.
- `POST /auth/set-password`: autorise uniquement si mot de passe local absent.

## Fichiers techniques de reference
- Backend OAuth: `backend/app/auth/routes.py`
- Securite mot de passe/sentinel: `backend/app/core/security.py`
- Settings backend env: `backend/app/core/settings.py`
- Client auth frontend: `frontend/lib/auth-client.ts`
- Callback frontend OAuth: `frontend/app/auth/oauth-callback/page.tsx`
- Ecran settings: `frontend/app/dashboard/settings/page.tsx`

---

## Passage en production: changements obligatoires
Ces points sont necessaires avant mise en prod.

1. URL HTTPS reelles
- `FRONTEND_URL=https://app.seqpulse.tld`
- `NEXT_PUBLIC_BACKEND_URL=https://api.seqpulse.tld`
- callback GitHub OAuth App:
  - `https://api.seqpulse.tld/auth/oauth/github/callback`

2. CORS strict
- Remplacer les `allow_origins` locaux dans `backend/app/main.py`
- Garder uniquement les domaines frontend de prod
- Eviter `*` en prod

3. Secrets
- Stocker `GITHUB_CLIENT_SECRET` et `SECRET_KEY` dans un secret manager
- Rotation periodique des secrets
- Ne jamais committer ces valeurs

4. JWT
- Verifier la duree (`JWT_ACCESS_TOKEN_EXPIRE_MINUTES`) pour la prod
- Activer monitoring des erreurs auth/token

5. GitHub OAuth App
- Verifier:
  - Homepage URL prod
  - Callback URL prod exacte
- Toute difference de scheme/domain/path casse le flow

## Passage en production: fortement recommande
1. Ne plus transporter le token dans l'URL fragment
- Strategie actuelle MVP: token dans `#access_token=...`
- Strategie prod recommandee:
  - backend pose un cookie `HttpOnly`, `Secure`, `SameSite=Lax|Strict`
  - frontend ne lit plus le token directement
  - APIs proteges via cookie + mecanisme CSRF adapte

2. Ajouter des logs d'audit OAuth
- debut auth OAuth
- callback succes/erreur
- creation automatique de compte
- set/change password

3. Durcir la validation OAuth
- conserver la verification `state`
- ajouter des protections supplementaires si necessaire (ex: nonce de corrrelation serveur)

4. Tests automatiques
- tests backend pour:
  - start callback success
  - callback error/state invalide
  - user creation vs existing user
  - set-password / change-password rules
- tests e2e frontend pour callback et redirection dashboard

## Checklist rapide prod
- [ ] Domaines prod frontend/backend definis
- [ ] HTTPS actif partout
- [ ] OAuth App GitHub configuree en prod
- [ ] CORS prod strict
- [ ] Secrets externalises (pas de .env en clair sur serveur)
- [ ] Strategie cookie secure planifiee (ou implementee)
- [ ] Logs + alertes auth en place
- [ ] Tests OAuth executes avant release

## Note sur Google OAuth (plus tard)
Pour ajouter Google, reutiliser exactement la meme architecture:
- `/auth/oauth/google/start`
- `/auth/oauth/google/callback`
- meme logique de creation utilisateur par email;
- meme logique `has_password` / `set-password`.
