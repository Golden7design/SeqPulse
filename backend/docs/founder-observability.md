# SeqPulse — Founder Observability (Vision “Dieu”)

Ce document décrit **tout ce qu’il faut mettre en place** pour avoir une vue complète de la production :  
trafic, usage produit, santé système, performance, pays des users, etc.

---

**Objectif**
Donner au fondateur une vue unifiée et fiable :
- Utilisation réelle de SeqPulse (DAU/MAU, sessions, features utilisées)
- Performance et stabilité (erreurs, latence, jobs, incidents)
- Répartition géographique des utilisateurs
- Signaux business (activation, rétention, churn)

---

## 1) Observabilité technique (santé système)
Pour savoir si SeqPulse tient en prod.

**À collecter**
- Temps de réponse API (P50/P95)
- Taux d’erreur (4xx/5xx)
- Taux de réussite des jobs (`pending/running/failed`)
- Durée moyenne de collecte et d’analyse
- Exceptions non gérées

**Implémentation**
- Logs structurés + stockage central
- Metrics internes (compteurs + histograms)
- Traces (optionnel au début)

---

## 2) Analytics produit (usage business)
Pour comprendre comment le produit est utilisé.

**Événements clés**
- `user_signup`
- `user_login`
- `project_created`
- `deployment_triggered`
- `deployment_finished`
- `analysis_completed`
- `verdict_viewed`
- `sdh_viewed`
- `settings_updated`

**Champs recommandés**
- `event_name`
- `user_id`
- `project_id`
- `plan`
- `timestamp`
- `country` (GeoIP)
- `properties` (JSON)

---

## 3) Geo & pays des users
**Méthode**
- Résoudre l’IP → pays avec GeoIP (MaxMind ou équivalent).
- Stocker le pays dans les events (pas besoin de IP brute).

---

## 4) Stockage analytics

**Phase 1 (simple)**
- Table `events` dans Postgres (OK pour démarrer).

**Phase 2 (scalabilité)**
- ClickHouse pour analytics lourds.

---

## 5) Dashboard “Founder View” (dans SeqPulse)
Vue unique avec :
- DAU / MAU
- Sessions moyennes
- Temps moyen passé
- Top projets actifs
- Jobs (pending / failed / stuck)
- Erreurs API (24h)
- Carte par pays

---

## 6) Alertes internes (Founder)
Alertes simples, intégrées au dashboard :
- Spike d’erreurs
- Jobs bloqués (`stuck_running > 0`)
- No data (plus d’événements)
- Downtime API

---

## 7) Sécurité & conformité
- Ne pas stocker d’IP brut si pas nécessaire.
- Minimiser les données PII.
- Rétention limitée (ex: 90 jours).

---

## 8) Roadmap pragmatique
1. Ajouter tracking d’événements (table Postgres).
2. Ajouter GeoIP (pays) dans les events.
3. Construire le dashboard “Founder View”.
4. Ajouter alertes internes.
5. Migrer ClickHouse si besoin.

---

**Résumé**
Pour une vision “Dieu” en prod, il faut **2 couches** :
- Observabilité technique (santé système)
- Analytics produit (usage réel)

Le tout doit être centralisé dans **le dashboard SeqPulse**.
