# SEQPULSE - Systeme de Jobs (explication simple)

## 1) C'est quoi un "job" ?
Un job est une petite tache en arriere-plan.  
Exemples: collecter des metriques, lancer une analyse, envoyer un email, envoyer une notif Slack.

Quand un deploiement arrive, SEQPULSE cree plusieurs jobs.  
Ensuite, le scheduler les prend et les execute.

---

## 2) Les types de jobs dans SEQPULSE
- `pre_collect`: collecte "avant"
- `post_collect`: collecte "apres" (souvent en plusieurs points)
- `analysis`: calcule le verdict
- `email_send`: envoie un email
- `slack_send`: envoie une notif Slack

---

## 3) Le cycle de vie d'un job
Chaque job passe par des etats simples:
- `pending` (en attente)
- `running` (en cours)
- `completed` (termine)
- `failed` (echec)

Si un job echoue, SEQPULSE peut le reprogrammer automatiquement (retry).

---

## 4) Comment SEQPULSE choisit les jobs a lancer
Le scheduler tourne en boucle:
1. il prend les jobs "dus" (`scheduled_at <= maintenant`)
2. il en selectionne un lot
3. il les lance en parallele (pas un par un)

### Parallele
Le nombre max de jobs en meme temps est controle par:
- `SCHEDULER_MAX_CONCURRENT_JOBS` (defaut: `10`)

Donc si 10 jobs tournent deja, le 11e attend un slot libre.

### Equite minimale (fairness)
SEQPULSE evite qu'un seul projet monopolise tout:
- il essaie de repartir les jobs entre projets/utilisateurs
- en pratique, dans un lot, on melange au lieu de prendre "tout projet A puis tout projet B"

---

## 5) Exemples concrets avec plusieurs devs

## Exemple A - 2 devs, charge legere
- Dev1 (Projet A): job a `12:00`
- Dev2 (Projet B): job a `12:01`
- Capacite: `10` jobs en parallele

Resultat:
- Le job de Dev2 peut demarrer vers `12:01` sans attendre la fin de Dev1, car il reste des slots.

## Exemple B - beaucoup de monde en meme temps
- 200 jobs dus en 5 minutes
- Capacite: `10` jobs en parallele

Resultat:
- Tous les jobs ne peuvent pas partir instantanement
- une file d'attente se forme
- certains jobs demarrent plus tard que leur horaire prevu

Conclusion:
- plus la capacite est grande, plus le retard baisse
- mais on ne peut pas promettre "demarrage exact a la seconde" en cas de pic fort

## Exemple C - anti-monopolisation
- Projet A envoie 50 jobs
- Projet B envoie 5 jobs

Sans equite:
- Projet A pourrait bloquer B longtemps

Avec l'equite actuelle:
- les jobs de B passent aussi dans les lots
- B n'est pas completement bloque par A

---

## 6) Que se passe-t-il si un job echoue ?
SEQPULSE reessaie avec des delais progressifs:
- retry 1: +30s
- retry 2: +120s
- retry 3: +300s

Apres le budget max de retries, le job passe en `failed`.

Cas special:
- certaines erreurs non recuperables (ex: probleme HMAC) sont marquees en echec direct, sans boucle infinie.

---

## 7) Que se passe-t-il si un job reste bloque ?
Si un job reste en `running` trop longtemps, SEQPULSE le recupere automatiquement:
- seuil: `SCHEDULER_RUNNING_STUCK_SECONDS` (defaut `600` = 10 min)
- le job est remis en attente ou marque en echec selon son nombre de retries

Ca evite les jobs "fantomes" bloques pour toujours.

---

## 8) Ce qu'on mesure pour piloter la qualite
SEQPULSE expose des metriques Prometheus, dont:
- jobs en attente
- jobs en echec
- delai de demarrage (`start_delay`) = `heure de demarrage reel - heure prevue`

Ce `start_delay` sert a verifier un objectif comme:
- `p95 < 2 minutes`

---

## 9) Ce que le systeme garantit (et ce qu'il ne garantit pas)

### Garantit
- execution en arriere-plan
- execution parallele (jusqu'a la limite configuree)
- retries automatiques
- recuperation des jobs bloques
- idempotence pratique: on limite les doubles traitements

### Ne garantit pas
- un demarrage exact a l'heure prevue pendant les gros pics
- un "exactly-once" strict (le modele vise surtout du `at-least-once` robuste)

---

## 10) Parametres principaux a regler
- `SCHEDULER_POLL_INTERVAL_SECONDS` (frequence de scan)
- `SCHEDULER_MAX_CONCURRENT_JOBS` (combien de jobs en parallele)
- `SCHEDULER_RUNNING_STUCK_SECONDS` (seuil de job bloque)
- `SCHEDULER_FAIRNESS_LOOKAHEAD_MULTIPLIER` (qualite de repartition entre projets)

---

## 11) Resume en une phrase
SEQPULSE execute les jobs en parallele, essaie de repartir la capacite entre projets, et reste robuste aux erreurs; en pic tres fort, il peut y avoir du retard, mais ce retard est mesurable et pilotable.

---

## 12) Config "safe" par environnement

### Staging (active dans `backend/.env`)
```env
SCHEDULER_POLL_INTERVAL_SECONDS=5
SCHEDULER_MAX_CONCURRENT_JOBS=10
SCHEDULER_RUNNING_STUCK_SECONDS=600
SCHEDULER_FAIRNESS_LOOKAHEAD_MULTIPLIER=5
```

### Prod (phase 1)
```env
SCHEDULER_POLL_INTERVAL_SECONDS=5
SCHEDULER_MAX_CONCURRENT_JOBS=15
SCHEDULER_RUNNING_STUCK_SECONDS=600
SCHEDULER_FAIRNESS_LOOKAHEAD_MULTIPLIER=5
```

### Prod (phase 2, apres validation)
```env
SCHEDULER_POLL_INTERVAL_SECONDS=5
SCHEDULER_MAX_CONCURRENT_JOBS=20
SCHEDULER_RUNNING_STUCK_SECONDS=600
SCHEDULER_FAIRNESS_LOOKAHEAD_MULTIPLIER=5
```

### Regle pour passer de 15 -> 20 en prod
On passe a `20` seulement si c'est stable pendant plusieurs jours:
- `p95 start_delay < 120s`
- pas de hausse anormale des jobs `failed`
- pas de contention DB significative (locks/latence)
