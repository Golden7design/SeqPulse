# SEQPULSE - Email Lifecycle MVP (Points Cruciaux Uniquement)

Derniere mise a jour: 19 fevrier 2026  
But: definir uniquement les emails indispensables pour lancer le MVP.

## 1. Objectif MVP

Le MVP email doit couvrir 2 choses:

1. Activer rapidement un nouvel utilisateur.
2. Convertir un projet Free quand il approche/atteint la limite.

Tout le reste (retention avancee, NPS, referral, etc.) est reporte apres MVP.

## 2. Scope MVP (obligatoire)

## 2.1 E-TRX-01 - Welcome apres signup
- Trigger: compte cree.
- Delai: immediat.
- But: pousser "creer premier projet".
- CTA unique: `Creer un projet`.
- Pourquoi critique: sans ce mail, beaucoup d'inscrits n'activent jamais le produit.

## 2.2 E-ACT-01 - Aucun projet cree apres signup
- Trigger: 2h apres signup, `projects.count = 0`.
- Delai: +2h.
- But: passer signup -> projet cree.
- CTA unique: `Creer mon premier projet`.
- Pourquoi critique: c'est le premier goulot d'etranglement d'activation.

## 2.3 E-ACT-04 - Premier verdict disponible (moment Aha)
- Trigger: premier `deployment_verdict` d'un projet.
- Delai: immediat.
- But: montrer la valeur concrete de SEQPULSE.
- CTA unique: `Voir le verdict complet`.
- Pourquoi critique: c'est le moment ou l'utilisateur comprend la promesse produit.

## 2.4 E-ACT-05 - Verdict critique (warning / rollback_recommended)
- Trigger: `deployment_verdict.verdict IN ('warning', 'rollback_recommended')`.
- Delai: immediat.
- But: reaction rapide sur incident potentiel.
- CTA unique: `Ouvrir le dashboard`.
- Pourquoi critique: alerte operationnelle a forte valeur percue.

## 2.5 E-CONV-01 - Quota Free a 80% (40/50)
- Trigger: deploiements mensuels projet free >= 40.
- Delai: < 1h.
- But: upsell anticipe avant blocage.
- CTA unique: `Passer au plan Pro`.
- Pourquoi critique: meilleur moment pour conversion non-frictionnelle.

## 2.6 E-CONV-03 - Quota Free atteint (50/50)
- Trigger: tentative de deployment refusee pour limite Free.
- Delai: immediat.
- But: conversion immediate pour debloquer le pipeline.
- CTA unique: `Reprendre les deploiements`.
- Pourquoi critique: intention d'achat la plus forte.

## 3. Fondations techniques MVP (indispensables)

## 3.1 Journal d'envoi + deduplication
- Table minimale: `email_deliveries`.
- Champs minimaux:
  - `user_id`
  - `project_id`
  - `email_type`
  - `dedupe_key` (unique)
  - `status`
  - `sent_at`
- Regle: ne jamais renvoyer la meme `dedupe_key`.

## 3.2 Orchestration via scheduler existant
- Reutiliser `scheduled_jobs` avec `job_type = 'email_send'`.
- Avantage: resilience deja en place (retries + persistance DB).

## 3.3 Limite de pression marketing
- Regle MVP: max 1 email marketing / 24h / utilisateur.
- Exception: emails transactionnels et alertes critiques (toujours envoyes).

## 4. KPI MVP a suivre des le jour 1

1. `signup_to_project_24h`: % signup -> premier projet en 24h.
2. `project_to_first_verdict_72h`: % projets avec 1er verdict en 72h.
3. `free_to_pro_from_quota_emails`: conversion apres E-CONV-01 + E-CONV-03.
4. `critical_alert_open_rate`: ouverture emails E-ACT-05.

## 5. Hors scope MVP (a faire apres)

Ces points sont reportes:

1. Invitations teammates (E-TRX-02).
2. Connexion suspecte et parcours securite avances.
3. Relances inactivite 14j/30j.
4. Rapports hebdo/mensuels automatises.
5. Dunning complet paiement echoue (J+3/J+7/J+10).
6. NPS, reviews, referral.
7. Segmentation avancee et A/B tests objets email.

## 6. Ordre d'implementation recommande (MVP)

Semaine 1:
1. `email_deliveries` + dedupe.
2. E-TRX-01 et E-ACT-01.
3. E-ACT-04.

Semaine 2:
1. E-ACT-05.
2. E-CONV-01.
3. E-CONV-03.

Definition de "MVP email termine":
1. Les 6 emails critiques sont actifs.
2. Dedupe fonctionne.
3. Les 4 KPI MVP remontent chaque semaine.
