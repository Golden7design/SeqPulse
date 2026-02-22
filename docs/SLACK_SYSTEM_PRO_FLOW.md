# SEQPULSE - Systeme de notifications Slack (flux Pro)

## 1. Principes produit

1. Slack est le canal de collaboration temps reel pour les plans Pro+.
2. L'email reste le canal universel et le fallback de securite.
3. Packaging de base:
- Free: email uniquement
- Pro: email + Slack
- Enterprise (plus tard): routing/gouvernance Slack avance

---

## 2. Flux complet (end-to-end)

### 2.1 Connexion Slack (OAuth)

1. Le proprietaire du projet lance la connexion Slack.
2. Le consentement OAuth est complete dans Slack.
3. SEQPULSE enregistre workspace + configuration du canal.
4. SEQPULSE envoie un message de test pour valider la configuration.

### 2.2 Configuration des alertes

1. Configurer le canal cible (exemple: `#seqpulse-alerts`).
2. Configurer le comportement par environnement (`prod` obligatoire, `staging` optionnel).
3. Configurer les controles anti-bruit (seuil de severite, cooldown, regroupement).
4. Configurer la politique de fallback: si envoi Slack echoue, envoyer un email.

### 2.3 Detection d'evenement

SEQPULSE genere des evenements de notification normalises, par exemple:
- `critical_verdict`
- `first_verdict`
- `quota_80`
- `quota_reached`

Chaque evenement transporte:
- project_id
- environnement
- severite
- identifiants de deploiement/run
- liens (dashboard/runbook)

### 2.4 Moteur de politiques

Avant de mettre en file un envoi Slack:
1. Verifier l'eligibilite du plan (Pro+).
2. Verifier la configuration projet/canal.
3. Verifier que le type de notification est active.
4. Appliquer dedupe + politique anti-bruit.

Si bloque, marquer en suppression avec raison explicite.

### 2.5 File et worker

1. Creer un job planifie `slack_send`.
2. Le worker execute avec retry/backoff.
3. Gerer les rate limits Slack (`429`) et les echecs transitoires.
4. En echec final: marquer failed + declencher fallback email (si configure).

### 2.6 Livraison Slack

Utiliser des messages Slack structures (style Block Kit) incluant:
- titre avec severite
- contexte projet/environnement
- resume concis
- liens CTA directs (dashboard/runbook)

### 2.7 Cycle de vie du thread

Pour une meme cle incident:
1. poster un message racine une seule fois
2. poster les mises a jour dans le meme thread
3. poster un message de resolution a la cloture

### 2.8 Observabilite

Suivre et exposer:
- taux de succes d'envoi
- latence d'envoi
- occurrences de rate limit
- raisons de suppression
- nombre de fallback vers email

---

## 3. Exigences de qualite (standard professionnel)

1. Idempotence stricte via dedupe keys.
2. Strategie de retry avec backoff exponentiel plafonne.
3. Comportement dead-letter pour echecs permanents.
4. Statuts explicites: `sent`, `failed`, `suppressed`, `skipped_dedup`.
5. Secrets chiffres au repos.
6. Audit logs pour changements d'integration/configuration.
7. UX de diagnostic: "pourquoi la notification n'a pas ete envoyee".

---

## 4. Strategie anti-bruit

1. Regrouper les evenements lies dans un thread incident.
2. Cooldown pour les alertes non critiques.
3. Prioriser les alertes critiques (tentative immediate systematique).
4. Mode digest optionnel pour evenements de faible priorite.

---

## 5. Strategie de packaging

### Free
- Notifications email uniquement

### Pro
- Notifications Slack en canal
- Mises a jour d'incident en thread
- Fallback email en cas d'echec Slack

### Enterprise (plus tard)
- Multi-workspace et routing avance
- Gouvernance role/politiques
- Controles et options de conformite etendus

---

## 6. Metriques de succes

1. MTTA (mean time to acknowledge) avant/apres rollout Slack.
2. Taux de succes de livraison Slack.
3. Taux de fallback Slack -> email.
4. Pourcentage d'incidents traites via thread Slack.
5. Conversion Free -> Pro apres exposition upsell Slack.

---

## 7. Notes de perimetre explicites

En MVP:
- Garder le modele projet mono-proprietaire.
- Ne pas introduire un modele complet de membres projet.
- Utiliser la collaboration en canal Slack comme couche de collaboration d'equipe.
