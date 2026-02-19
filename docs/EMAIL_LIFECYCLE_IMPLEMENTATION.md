# SEQPULSE - Implementation Email Lifecycle (Conversion + Usage)

Derniere mise a jour: 19 fevrier 2026  
Portee: definir precisement quand SEQPULSE doit envoyer des emails, avec des exemples concrets et des regles d'implementation.

## 1. Objectif

Ce document couvre 2 objectifs business:

1. Conversion Free -> Pro
2. Activation + retention produit (usage reel de SEQPULSE)

Le principe est simple: chaque email a un seul job, une seule action ciblee, et un trigger mesurable.

## 2. Principes d'envoi

1. Un email = un objectif principal + un CTA principal.
2. Priorite a la valeur avant l'upsell.
3. Envoi base sur comportements reels (pas seulement des dates arbitraires).
4. Dedupe obligatoire (ne pas envoyer 2 fois le meme email pour le meme contexte).
5. Respect de la pression marketing: max 1 email marketing / 24h / utilisateur (hors securite et transactionnel).

## 3. Segments SEQPULSE utilises

1. `new_user`: utilisateur cree depuis moins de 14 jours.
2. `free_active`: utilisateur free avec activite recente.
3. `free_near_limit`: projet free >= 80% du quota mensuel.
4. `pro_active`: utilisateur sur projet pro actif.
5. `at_risk`: baisse d'activite ou inactivite.
6. `security_sensitive`: utilisateurs avec 2FA active ou actions sensibles.

## 4. Catalogue des moments d'envoi (avec exemples concrets)

## 4.1 Transactionnel + securite

### E-TRX-01 - Welcome apres signup
- Trigger: creation de compte validee.
- Delai: immediat.
- Audience: `new_user`.
- Objectif: faire creer le premier projet.
- Exemple concret:
  - Nassir cree son compte a 10:04.
  - A 10:04:05, il recoit "Bienvenue sur SEQPULSE" avec bouton "Creer mon premier projet".
- Sujet exemple: `Bienvenue sur SEQPULSE - Cree ton premier projet en 2 minutes`
- CTA: `Creer un projet`
- KPI: taux de creation de projet < 24h.

### E-TRX-02 - Invitation teammate
- Trigger: un user A invite un user B.
- Delai: immediat, relance J+2 puis J+5 si non accepte.
- Audience: invite non actif.
- Objectif: acceptance invite.
- Exemple concret:
  - Nadia invite `devops@acme.com`.
  - Si non accepte en 48h: relance "Nadia t'attend sur le projet API Gateway".
- Sujet exemple: `Nadia vous a invite a rejoindre le projet "API Gateway"`
- CTA: `Accepter l'invitation`
- KPI: taux d'acceptation invite.

### E-SEC-01 - 2FA active/desactivee
- Trigger: changement `users.twofa_enabled`.
- Delai: immediat.
- Audience: `security_sensitive`.
- Objectif: confirmer l'action et detecter un changement non autorise.
- Exemple concret:
  - 2FA desactivee a 22:41 depuis un nouvel appareil.
  - Email immediat: "Si ce n'etait pas vous, contactez le support et revoquez vos sessions."
- Sujet exemple: `Alerte securite: votre 2FA a ete desactivee`
- CTA: `Securiser mon compte`
- KPI: temps de reaction sur incidents securite.

### E-SEC-02 - Connexion suspecte
- Trigger: login depuis IP/pays/device inhabituel (regle anti-anomalie).
- Delai: immediat.
- Audience: tous users.
- Objectif: verification utilisateur.
- Exemple concret:
  - User habituel connecte depuis Paris, login soudain depuis autre region.
  - Email avec heure, device, localisation approximative.
- Sujet exemple: `Nouvelle connexion detectee sur votre compte SEQPULSE`
- CTA: `Ce n'etait pas moi`
- KPI: taux de confirmation legitime vs signalement.

## 4.2 Activation produit (J0 -> J14)

### E-ACT-01 - Signup sans projet cree
- Trigger: user cree mais aucun projet apres 2h.
- Delai: +2h.
- Audience: `new_user`.
- Objectif: passer de signup -> premier projet.
- Exemple concret:
  - User inscrit a 09:00, `projects.count = 0` a 11:00.
  - Email: "Tu es a 1 etape de ton premier verdict deployment."
- Sujet exemple: `Il vous manque 1 etape pour activer SEQPULSE`
- CTA: `Creer un projet`
- KPI: taux de projets crees < 24h apres signup.

### E-ACT-02 - Projet cree sans CI/CD connecte
- Trigger: projet existe, aucun deployment trigger apres 24h.
- Delai: +24h apres creation projet.
- Audience: `new_user`.
- Objectif: connecter pipeline.
- Exemple concret:
  - Projet `Checkout API` cree hier, aucun appel `/deployments/trigger`.
  - Email avec snippet GitHub Actions minimal.
- Sujet exemple: `Connecte ton pipeline pour obtenir ton premier verdict`
- CTA: `Voir le guide CI/CD`
- KPI: taux de premier deployment < 72h.

### E-ACT-03 - Pipeline connecte mais aucun deployment fini
- Trigger: deployment `running` mais jamais `finished` apres 48h.
- Delai: +48h.
- Audience: users bloques.
- Objectif: finaliser le flux trigger/finish.
- Exemple concret:
  - 1 trigger recu, 0 finish.
  - Email: "Tu envoies bien trigger, pense a notifier finish pour lancer l'analyse."
- Sujet exemple: `Votre analyse SEQPULSE est en attente de "finish"`
- CTA: `Corriger mon integration`
- KPI: ratio trigger->finish.

### E-ACT-04 - Premier verdict disponible (moment Aha)
- Trigger: 1er enregistrement `deployment_verdicts` d'un projet.
- Delai: immediat.
- Audience: user owner + eventuels admins.
- Objectif: faire revenir dans dashboard pour lire la valeur.
- Exemple concret:
  - Verdict `warning` sur deployment #12.
  - Email resume: latence +18%, erreurs +1.3 pts.
- Sujet exemple: `Premier verdict SEQPULSE pour API Gateway: warning`
- CTA: `Voir le verdict complet`
- KPI: taux d'ouverture + taux de clic vers verdict.

### E-ACT-05 - SDH critique (warning/rollback_recommended)
- Trigger: verdict `warning` ou `rollback_recommended`.
- Delai: immediat.
- Audience: owner projet + on-call list.
- Objectif: reaction rapide avant impact client.
- Exemple concret:
  - `rollback_recommended` sur prod a 14:02.
  - Email instantane avec 3 actions suggerees depuis `sdh_hints`.
- Sujet exemple: `Urgent: rollback recommande sur Checkout API (prod)`
- CTA: `Ouvrir le runbook de remediation`
- KPI: MTTR, delai ouverture email -> consultation dashboard.

## 4.3 Conversion Free -> Pro

### E-CONV-01 - 80% du quota atteint (40/50)
- Trigger: deploiements mensuels projet free >= 40.
- Delai: dans l'heure.
- Audience: `free_near_limit`.
- Objectif: upsell anticipe.
- Exemple concret:
  - Projet free a 42 deploiements le 18 du mois.
  - Email: "Tu approches la limite. Passe Pro pour garder ta cadence."
- Sujet exemple: `Votre projet approche la limite Free (40/50)`
- CTA: `Passer au plan Pro`
- KPI: conversion a 7 jours post-email.

### E-CONV-02 - 90% du quota (45/50)
- Trigger: deploiements mensuels projet free >= 45.
- Delai: dans l'heure.
- Audience: `free_near_limit`.
- Objectif: pousser decision avant blocage.
- Exemple concret:
  - Equipe deploye 3 fois/jour, risque de blocage sous 48h.
  - Email chiffre: "x anomalies SDH potentielles non visibles en Free."
- Sujet exemple: `Plus que 5 deploiements avant blocage`
- CTA: `Debloquer les deploiements illimites`
- KPI: upgrade rate avant limite atteinte.

### E-CONV-03 - Limite 50/50 atteinte
- Trigger: tentative de deployment refusee pour quota atteint.
- Delai: immediat.
- Audience: owner projet free.
- Objectif: conversion immediate.
- Exemple concret:
  - Tentative deployment #51 retour 402.
  - Email: "Ton pipeline est bloque tant que le plan reste Free."
- Sujet exemple: `Action requise: limite Free atteinte pour votre projet`
- CTA: `Reprendre les deploiements`
- KPI: conversion en < 24h.

### E-CONV-04 - Tentative feature Pro
- Trigger: clic ou tentative sur feature Pro (SDH complet, retention 30j, export, alertes).
- Delai: immediat ou < 30 min.
- Audience: free engages.
- Objectif: conversion contextuelle.
- Exemple concret:
  - User clique "Exporter CSV", feature gate.
  - Email: "L'export est reserve Pro. Active-le en 1 clic."
- Sujet exemple: `Cette fonctionnalite est prete pour vous en Pro`
- CTA: `Activer Pro`
- KPI: click-to-upgrade.

### E-CONV-05 - Rapport mensuel valeur (Free)
- Trigger: fin de mois.
- Delai: J+1 du nouveau mois.
- Audience: tous projets free actifs.
- Objectif: rendre visible la valeur non captee.
- Exemple concret:
  - "Ce mois-ci: 47 deploiements, 6 warnings, 2 alertes critiques potentielles SDH."
- Sujet exemple: `Votre bilan SEQPULSE de fevrier (+ opportunites Pro)`
- CTA: `Voir le plan Pro`
- KPI: conversion mensuelle par cohorte.

## 4.4 Retention, usage continu et re-engagement

### E-RET-01 - Rapport hebdo usage
- Trigger: chaque semaine (lundi 08:00 locale).
- Delai: planifie.
- Audience: users actifs (free + pro).
- Objectif: ancrer l'habitude produit.
- Exemple concret:
  - "8 deploiements, 1 warning, latence p95 mediane en baisse de 12%."
- Sujet exemple: `Votre semaine SEQPULSE: 8 deploiements, 1 alerte`
- CTA: `Ouvrir le dashboard`
- KPI: WAU, retour hebdo.

### E-RET-02 - Baisse d'activite significative
- Trigger: baisse >= 50% des deploiements semaine N vs N-1.
- Delai: dans les 24h de detection.
- Audience: `at_risk`.
- Objectif: prevenir churn silencieux.
- Exemple concret:
  - Projet passe de 20 deploiements a 7.
  - Email orientee aide: "Souhaitez-vous qu'on verifie votre integration ?"
- Sujet exemple: `On a remarque une baisse d'activite sur votre projet`
- CTA: `Demander un check integration`
- KPI: reactivation a 7 jours.

### E-RET-03 - Inactivite 14 jours
- Trigger: aucun login utile ou aucun projet actif 14 jours.
- Delai: J14.
- Audience: `at_risk`.
- Objectif: relance douce.
- Exemple concret:
  - Aucun verdict consulte depuis 2 semaines.
  - Email "Reprends en 2 minutes" + checklist courte.
- Sujet exemple: `Votre cockpit deployment vous attend`
- CTA: `Reprendre SEQPULSE`
- KPI: taux de retour 14->21 jours.

### E-RET-04 - Inactivite 30 jours (re-engagement fort)
- Trigger: aucune activite 30 jours.
- Delai: J30, puis rappel J37.
- Audience: `at_risk` severe.
- Objectif: recuperer ou nettoyer.
- Exemple concret:
  - 0 sessions, 0 deploiement depuis 30 jours.
  - Email direct: "Souhaitez-vous garder vos alertes actives ?"
- Sujet exemple: `Souhaitez-vous continuer a recevoir les alertes SEQPULSE ?`
- CTA: `Oui, je reste actif`
- KPI: win-back rate + taux desinscription propre.

## 4.5 Billing et revenu

### E-BILL-01 - Paiement echoue (dunning)
- Trigger: webhook paiement echoue.
- Delai: J0, J+3, J+7, J+10.
- Audience: owner projet pro.
- Objectif: recuperation revenu.
- Exemple concret:
  - Carte expiree, subscription `past_due`.
  - Sequence:
    - J0: info simple + lien update carte.
    - J+3: rappel.
    - J+7: avertissement interruption.
    - J+10: dernier rappel.
- Sujet exemple: `Action requise: votre paiement SEQPULSE a echoue`
- CTA: `Mettre a jour le moyen de paiement`
- KPI: recovery rate.

### E-BILL-02 - Paiement/renouvellement reussi
- Trigger: webhook paiement valide.
- Delai: immediat.
- Audience: owner projet pro.
- Objectif: rassurer + renforcer valeur.
- Exemple concret:
  - Renouvellement mensuel confirme.
  - Email: facture + rappel de la valeur du mois precedent.
- Sujet exemple: `Renouvellement confirme - votre projet reste protege`
- CTA: `Voir les performances du mois`
- KPI: reduction tickets billing.

## 4.6 Advocacy (preuves sociales)

### E-ADV-01 - NPS apres milestone
- Trigger: milestone positif (ex: 30 jours actifs + > X deploiements).
- Delai: dans la semaine du milestone.
- Audience: users engages.
- Objectif: mesurer satisfaction et detecter promoteurs.
- Exemple concret:
  - Equipe active depuis 45 jours, incidents en baisse.
  - Email NPS 0-10.
- Sujet exemple: `Comment evaluez-vous SEQPULSE aujourd'hui ?`
- CTA: `Donner ma note`
- KPI: score NPS, taux de reponse.

### E-ADV-02 - Demande review apres NPS promoteur
- Trigger: NPS >= 9.
- Delai: J+1 apres reponse NPS.
- Audience: promoteurs.
- Objectif: reviews publiques et referral.
- Exemple concret:
  - User note 10/10.
  - Email court: "2 minutes pour partager votre retour ?"
- Sujet exemple: `Merci pour votre confiance - un petit avis ?`
- CTA: `Laisser un avis`
- KPI: volume et qualite des reviews.

## 5. Exemples complets de copy (emails prioritaires)

## 5.1 Upsell 80% quota (E-CONV-01)

Sujet: `Votre projet approche la limite Free (40/50)`

Corps:
```
Bonjour {first_name},

Votre projet "{project_name}" a atteint {deployments_used}/50 deploiements ce mois-ci.
Au rythme actuel, vous atteindrez la limite dans {estimated_days_left} jours.

Passez au plan Pro pour:
- Deploiements illimites
- SDH complet
- Alertes Email/Slack

CTA: Passer au plan Pro
```

## 5.2 Alerte rollback recommande (E-ACT-05)

Sujet: `Urgent: rollback recommande sur {project_name} ({env})`

Corps:
```
SEQPULSE a detecte un risque eleve sur le deployment #{deployment_number}.

Verdict: rollback_recommended
Signaux:
- latency_p95: +{latency_delta}%
- error_rate: +{error_rate_delta} pts

Actions suggerees:
1) rollback sur la version precedente
2) verifier les changements DB
3) surveiller le trafic 15 min

CTA: Voir le verdict complet
```

## 5.3 Inactivite 14 jours (E-RET-03)

Sujet: `Votre cockpit deployment vous attend`

Corps:
```
Bonjour {first_name},

Nous n'avons pas vu d'activite recente sur SEQPULSE.
En 2 minutes, vous pouvez relancer la surveillance:

1) verifier votre dernier projet
2) lancer un deployment test
3) consulter le verdict

CTA: Reprendre SEQPULSE
```

## 6. Conditions techniques (exemples SQL concrets)

Les requetes ci-dessous sont des exemples de detection de trigger.  
Elles doivent etre executees par un job planifie (ex: toutes les 15 min pour conversion/activation, quotidien pour retention).

### 6.1 Projets free proches du quota (40/50)
```sql
SELECT
  p.id AS project_id,
  p.owner_id,
  COUNT(d.id) AS deployments_used
FROM projects p
JOIN deployments d ON d.project_id = p.id
WHERE p.plan = 'free'
  AND d.started_at >= date_trunc('month', now())
GROUP BY p.id, p.owner_id
HAVING COUNT(d.id) >= 40;
```

### 6.2 Utilisateurs sans projet 2h apres signup
```sql
SELECT
  u.id AS user_id,
  u.email,
  u.created_at
FROM users u
LEFT JOIN projects p ON p.owner_id = u.id
WHERE p.id IS NULL
  AND u.created_at <= now() - interval '2 hours';
```

### 6.3 Projets avec verdict critique recents
```sql
SELECT
  p.id AS project_id,
  p.owner_id,
  d.id AS deployment_id,
  dv.verdict,
  dv.created_at
FROM deployment_verdicts dv
JOIN deployments d ON d.id = dv.deployment_id
JOIN projects p ON p.id = d.project_id
WHERE dv.verdict IN ('warning', 'rollback_recommended')
  AND dv.created_at >= now() - interval '15 minutes';
```

### 6.4 Inactivite 30 jours
```sql
SELECT
  u.id AS user_id,
  u.email,
  MAX(d.started_at) AS last_deployment_at
FROM users u
LEFT JOIN projects p ON p.owner_id = u.id
LEFT JOIN deployments d ON d.project_id = p.id
GROUP BY u.id, u.email
HAVING COALESCE(MAX(d.started_at), u.created_at) <= now() - interval '30 days';
```

## 7. Plan d'implementation backend (MVP pragmatique)

## 7.1 Provider email
- Recommande: Resend ou Postmark pour MVP (simplicite + bonne delivrabilite).
- Variables env minimales:
  - `EMAIL_PROVIDER`
  - `EMAIL_FROM`
  - `EMAIL_API_KEY`

## 7.2 Tables a ajouter

### `email_deliveries`
- But: journal d'envoi et anti-duplication.
- Champs:
  - `id` (uuid)
  - `user_id`
  - `project_id` (nullable)
  - `email_type` (ex: `E-CONV-01`)
  - `dedupe_key` (unique)
  - `status` (`queued`, `sent`, `failed`)
  - `provider_message_id`
  - `payload_json`
  - `sent_at`, `created_at`

### `email_preferences`
- But: gestion opt-out marketing.
- Champs:
  - `user_id`
  - `marketing_opt_in` (bool)
  - `product_updates_opt_in` (bool)
  - `security_opt_in` (bool, force true par defaut)

## 7.3 Orchestration des envois

Option recommandee: reutiliser le scheduler persistant existant.

1. Etendre `scheduled_jobs.job_type` avec `email_send`.
2. Ajouter une execution `email_send` dans `app/scheduler/poller.py`.
3. Stocker dans `job_metadata`:
   - `email_type`
   - `user_id`
   - `project_id`
   - `template_context`
   - `dedupe_key`

## 7.4 Regles anti-spam minimales

1. Bloquer si `dedupe_key` deja envoyee.
2. Bloquer si email marketing envoye dans les 24h.
3. Toujours autoriser securite/transactionnel.
4. Ajouter lien de desinscription pour marketing.

## 8. KPI de suivi (tableau de pilotage)

1. `activation_24h`: % signup -> projet cree en 24h.
2. `first_deployment_72h`: % projet -> 1er deployment en 72h.
3. `free_to_pro_conversion_30d`: conversion a 30 jours.
4. `quota_email_to_upgrade`: conversion suite E-CONV-01/02/03.
5. `alert_open_rate`: ouverture des emails d'alerte critique.
6. `reactivation_rate`: retour d'usage apres E-RET-03/04.
7. `dunning_recovery_rate`: recuperation paiements echoues.

## 9. Priorisation de mise en production

Phase 1 (semaine 1):
1. E-TRX-01, E-ACT-01, E-ACT-04
2. E-CONV-01, E-CONV-03
3. `email_deliveries` + dedupe

Phase 2 (semaine 2):
1. E-ACT-05 (alertes critiques)
2. E-RET-01, E-RET-03
3. E-BILL-01 (dunning)

Phase 3 (semaine 3+):
1. NPS + review loops
2. Optimisation segments et A/B tests objets email
3. Ajustements cadence selon KPI reels

---

Ce document est la reference d'implementation pour la couche email lifecycle de SEQPULSE.  
Toute nouvelle campagne doit re-utiliser les codes `E-*` et definir un dedupe clair avant mise en prod.
