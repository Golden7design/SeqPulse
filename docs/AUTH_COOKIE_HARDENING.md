# Pourquoi le passage au cookie HttpOnly est critique

## Contexte
SeqPulse utilisait initialement un modele d'authentification base sur:
- token JWT recu dans l'URL (fragment `#access_token=...`) apres OAuth;
- stockage du token dans `localStorage`;
- envoi du token via header `Authorization`.

Nous avons migre vers un modele base sur:
- cookie de session `HttpOnly` pose par le backend;
- lecture serveur du token depuis cookie;
- requetes frontend avec `credentials: include`.

## Probleme avec l'ancien modele
L'ancien modele fonctionne, mais il expose plus de surface de risque.

Principales limites:
- un token dans l'URL peut fuiter via logs/outils navigateur/copies d'URL;
- un token en `localStorage` est accessible au JavaScript;
- en cas de XSS, le vol du token est plus simple;
- la logique de session est dupliquee (client + serveur) et plus fragile.

## Avantages du nouveau modele
Le nouveau modele est plus robuste pour une utilisation reelle (et encore plus en prod).

Gains securite:
- `HttpOnly`: le token n'est pas lisible par le JavaScript de la page;
- reduction du risque de vol de token via XSS;
- plus de token OAuth expose dans l'URL de callback;
- meilleure hygiene de session (set/clear cote serveur).

Gains architecture:
- source de verite session cote backend;
- auth unifiee pour login email/password et OAuth;
- endpoint logout central (`/auth/logout`) qui invalide le cookie client.

Gains UX:
- moins de cas de desynchronisation entre token local et session reelle;
- callback OAuth plus propre (pas de parsing `#access_token`);
- validation de session plus deterministe dans `AuthGate` et `/auth`.

## Comparatif direct: ancien vs nouveau
Ancien:
- token visible dans le fragment URL;
- token persiste en `localStorage`;
- auth pilotee majoritairement cote client.

Nouveau:
- token en cookie `HttpOnly` (non accessible au JS);
- pas de token dans l'URL;
- auth pilotee par le backend, frontend simplifie.

## Impact concret dans SeqPulse
Ce changement a introduit:
- pose cookie sur login/password;
- pose cookie sur callback OAuth GitHub/Google;
- fallback de lecture token via cookie prioritaire;
- endpoint de logout serveur;
- frontend `fetch` avec `credentials: include`;
- parcours OAuth sans extraction de token depuis URL.

## Pourquoi c'est meilleur pour la production
En production, ce modele est plus defensif et plus maintenable.

Avec la configuration adaptee:
- `AUTH_COOKIE_SECURE=true`;
- `AUTH_COOKIE_SAMESITE=lax` (ou `none` si cross-site strictement necessaire);
- HTTPS obligatoire,

on obtient une posture de securite nettement superieure au modele localStorage.

## Points d'attention
Le cookie HttpOnly n'est pas une solution magique. Il faut aussi:
- une politique CORS stricte;
- une strategie CSRF adaptee selon le mode de deploiement;
- une hygiene XSS globale;
- une rotation et protection des secrets.

## Conclusion
Le passage au cookie HttpOnly est une evolution structurelle:
- moins d'exposition de tokens;
- meilleure separation des responsabilites frontend/backend;
- base plus saine pour scaler l'authentification SeqPulse en prod.
