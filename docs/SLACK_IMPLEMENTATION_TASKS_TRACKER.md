# SEQPULSE - Tracker des taches d'implementation Slack

Valeurs de statut:
- [ ] Non demarre
- [~] En cours
- [x] Termine
- [!] Bloque

## 0. Gouvernance

- Date de debut:
- Date cible de fin:
- Responsable technique:
- Responsable produit:
- Responsable QA:

---

## 1. Verrouillage produit et perimetre

- [ ] Definir le perimetre MVP (Slack Pro-only, pas de changement du modele de membres projet).
- [ ] Confirmer les types de notification inclus dans le MVP Slack.
- [ ] Confirmer la politique de fallback (echec Slack => email).
- [ ] Confirmer le message Free/Pro et les besoins de copy upsell.

Criteres d'acceptation:
- Perimetre documente et valide.
- Aucune ambiguite sur le gating plan et les limites de fonctionnalite.

---

## 2. Modele de donnees et migrations

- [ ] Creer la table `slack_deliveries`.
- [ ] Ajouter un index unique sur dedupe key.
- [ ] Ajouter les index user/project/type/status/created_at/sent_at.
- [ ] Definir le modele de statut (`queued`, `sent`, `failed`, `suppressed`).
- [ ] Ajouter un chemin de rollback de migration.

Criteres d'acceptation:
- La migration s'applique proprement en dev/staging.
- Les performances de requete sont acceptables sur les colonnes indexees.

---

## 3. Configuration et secrets

- [ ] Ajouter les settings Slack dans la config backend (`SLACK_ENABLED`, secrets OAuth, etc.).
- [ ] Ajouter une strategie de stockage chiffre des tokens Slack.
- [ ] Ajouter la documentation des variables d'environnement dans `README.md`.

Criteres d'acceptation:
- L'application demarre avec Slack desactive par defaut.
- Les secrets manquants produisent des erreurs explicites (pas d'echec silencieux).

---

## 4. OAuth et configuration d'integration

- [ ] Implementer l'endpoint de connexion OAuth Slack.
- [ ] Implementer l'endpoint callback OAuth Slack.
- [ ] Persister workspace et canal par projet.
- [ ] Ajouter un endpoint "envoyer un message test".
- [ ] Ajouter un flux de deconnexion/revocation.

Criteres d'acceptation:
- Connect -> callback -> message test fonctionne de bout en bout.
- La deconnexion retire immediatement la capacite d'envoyer des notifications Slack.

---

## 5. Couche service Slack

- [ ] Creer `app/slack/service.py`.
- [ ] Implementer `send_slack_if_not_sent(...)` avec idempotence.
- [ ] Implementer les raisons de suppression (rollout desactive, config absente, cooldown, etc.).
- [ ] Implementer la normalisation des reponses provider.
- [ ] Implementer une taxonomie d'erreurs robuste (retryable vs non-retryable).

Criteres d'acceptation:
- Les dedupe keys dupliquees n'envoient jamais deux fois.
- Les erreurs sont classees de maniere coherente pour le comportement de retry.

---

## 6. Integration scheduler

- [ ] Ajouter le helper `schedule_slack(...)` dans les taches scheduler.
- [ ] Ajouter la branche d'execution `slack_send` dans le poller.
- [ ] Reutiliser le comportement retry/backoff existant.
- [ ] Implementer le fallback email en echec final Slack.

Criteres d'acceptation:
- Les jobs `slack_send` parcourent correctement leur cycle de statut.
- Le chemin d'echec final declenche la politique de fallback specifiee.

---

## 7. Raccordement des evenements

- [ ] Raccorder la planification Slack dans les flux cibles (analysis/deployments/auth selon besoin).
- [ ] Reutiliser la taxonomie des types de notifications existante.
- [ ] Garantir que le gating plan est applique avant planification Slack.

Criteres d'acceptation:
- Les projets Free ne recoivent jamais de jobs Slack.
- Les projets Pro recoivent des jobs Slack selon les regles configurees.

---

## 8. Templates de message et threading

- [ ] Implementer les templates Slack par type de notification.
- [ ] Definir la strategie de cle incident/thread.
- [ ] Implementer message racine + mises a jour en thread + message de resolution.
- [ ] Valider le formatage (lisibilite + actionnabilite).

Criteres d'acceptation:
- Les messages sont concis, contextuels, et contiennent des liens actionnables.
- Les mises a jour repetees d'un meme incident sont correctement threadees.

---

## 9. Controles anti-bruit

- [ ] Implementer la politique de dedupe.
- [ ] Implementer les fenetres de cooldown pour les evenements non critiques.
- [ ] Implementer le chemin prioritaire pour evenements critiques.
- [ ] Ajouter la telemetrie des raisons de suppression.

Criteres d'acceptation:
- Le volume de bruit est reduit sans perdre les alertes critiques.
- Les suppressions sont explicables dans logs/telemetrie.

---

## 10. Observabilite et audit

- [ ] Ajouter des logs structures pour chaque tentative de livraison Slack.
- [ ] Ajouter des metriques: taux de succes, latence, retries, nombre de fallback.
- [ ] Ajouter des evenements d'audit pour connexion/deconnexion/changement de canal.
- [ ] Ajouter des panneaux dashboard pour la sante des notifications Slack.

Criteres d'acceptation:
- Le on-call peut diagnostiquer les echecs de livraison en quelques minutes.
- Le produit peut suivre adoption et efficacite.

---

## 11. Revue securite

- [ ] Valider les scopes Slack minimaux.
- [ ] Valider la verification de signature callback.
- [ ] Valider chiffrement des tokens et redaction des secrets dans les logs.
- [ ] Valider le controle d'acces des endpoints de configuration.

Criteres d'acceptation:
- La checklist securite est validee.
- Aucun secret n'est expose dans les logs ou reponses API.

---

## 12. Tests

- [ ] Tests unitaires pour idempotence et logique de suppression.
- [ ] Tests unitaires pour execution scheduler `slack_send`.
- [ ] Tests d'integration pour le flux OAuth connect/callback.
- [ ] Tests d'integration pour comportement de fallback email.
- [ ] Tests de non-regression pour verifier que le flux email existant n'est pas casse.

Criteres d'acceptation:
- Tous les tests passent en CI.
- Aucune regression sur le lifecycle email existant.

---

## 13. Plan de release

- [ ] Feature flag pour le rollout Slack.
- [ ] Dogfooding interne avec un projet.
- [ ] Rollout beta limite Pro.
- [ ] Rollout Pro complet.
- [ ] Revue KPI post-release apres 2 semaines.

Criteres d'acceptation:
- Le rollout peut etre arrete rapidement via config/flag.
- Le baseline KPI et la comparaison post-rollout sont documentes.

---

## 14. Journal des risques / decisions ouvertes

- [ ] Decider le comportement par defaut si canal supprime/archive.
- [ ] Decider le plafond de retries avant fallback email.
- [ ] Decider si opt-out utilisateur par type est autorise en MVP.
- [ ] Decider si les alertes staging sont activees par defaut.

---

## 15. Definition of Done finale

- [ ] Les projets Pro peuvent connecter Slack et recevoir les alertes configurees.
- [ ] Les projets Free sont correctement gates en email-only.
- [ ] Idempotence, retries, fallback et controles anti-bruit sont verifies.
- [ ] Les dashboards monitoring et logs d'audit sont operationnels.
- [ ] La documentation est complete et a jour.
