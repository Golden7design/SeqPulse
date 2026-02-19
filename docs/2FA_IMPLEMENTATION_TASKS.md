# 2FA Tasks - SeqPulse

## Objectif
Implémenter une 2FA robuste (TOTP) pour les comptes SeqPulse, compatible login classique et OAuth.

## Plan des tâches

### Étape 1 - Schéma DB et fondations backend
- [x] Ajouter les champs 2FA dans `users`
- [x] Ajouter une table `auth_challenges` pour les challenges de login 2FA
- [x] Créer la migration Alembic correspondante
- [x] Mettre à jour les modèles SQLAlchemy

Livrables de l'étape 1:
- `backend/app/db/models/user.py`
- `backend/app/db/models/auth_challenge.py`
- `backend/app/db/models/__init__.py`
- `backend/migrations/versions/c9e5f2a1b7d3_add_twofa_fields_and_auth_challenges.py`

### Étape 2 - Services 2FA (TOTP + recovery)
- [x] Générer un secret TOTP par utilisateur
- [x] Chiffrer/déchiffrer le secret côté backend
- [x] Générer des recovery codes et stocker leurs hash
- [x] Ajouter la validation TOTP avec fenêtre temporelle
- [x] Empêcher la réutilisation de code (`twofa_last_totp_step`)

### Étape 3 - API backend 2FA
- [x] `GET /auth/2fa/status`
- [x] `POST /auth/2fa/setup/start`
- [x] `POST /auth/2fa/setup/verify`
- [x] `POST /auth/2fa/challenge/verify`
- [x] `POST /auth/2fa/disable`
- [x] `POST /auth/2fa/recovery-codes/regenerate`

### Étape 4 - Intégration login/password et OAuth
- [x] Modifier `/auth/login` pour retourner `requires_2fa` si activée
- [x] Modifier callbacks OAuth (GitHub/Google) pour passer par challenge 2FA
- [x] Gérer session pré-auth courte avant validation 2FA
- [x] Émettre session finale seulement après challenge valide

### Étape 5 - Frontend (auth + settings)
- [x] Créer page challenge 2FA (`/auth/2fa-challenge`)
- [x] Ajouter le flow setup/enable dans Settings
- [x] Ajouter disable 2FA + régénération recovery codes
- [x] UX d'erreur claire (code invalide, challenge expiré, verrouillage)

### Étape 6 - Sécurité et garde-fous
- [x] Rate limit strict sur endpoints challenge/setup
- [x] Audit logs (enable/disable/challenge success/fail/recovery use)
- [ ] Notifications utilisateur sur événements sensibles 2FA
- [ ] Vérifier CORS/CSRF/session cookie selon l'architecture prod

### Étape 7 - Tests
- [x] Tests unitaires service TOTP/recovery
- [x] Tests API backend (setup, verify, challenge, disable)
- [ ] Tests e2e frontend (password, GitHub, Google + 2FA)

## Notes d'implémentation
- Méthode 2FA cible: TOTP (apps Authenticator), pas SMS par défaut.
- Les recovery codes sont à afficher une seule fois côté UI.
- 2FA doit s'appliquer aussi aux logins OAuth.
