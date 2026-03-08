# SeqPulse Metrics Verdict v2 (Percentile-First)

## Objectif
Ce document définit la nouvelle logique d’analyse post‑déploiement de SeqPulse.
L’objectif est d’augmenter la fiabilité du verdict tout en conservant la cadence actuelle
(séquences fixes) et les endpoints existants du pipeline.

Objectifs principaux :
- Réduire les faux positifs/négatifs dus au sampling sparse ou à l’absence de trafic.
- Rendre le verdict plus robuste via les percentiles et les tolérances, au lieu de la moyenne.
- Garder une logique transparente, déterministe et en O(n).

## Pipeline actuel (inchangé)
- Pendant le déploiement : le pipeline appelle `POST /trigger`.
  - SeqPulse capture le **baseline PRE** (snapshot par métrique).
- Après le déploiement : le pipeline appelle `POST /finish`.
  - SeqPulse collecte les métriques **POST** en séquences fixes (ex: 60s par séquence)
    pendant la fenêtre d’observation du projet.

Seule **la logique d’analyse** change.

## Définitions
- **Séquence** : un point agrégé par période fixe (ex: 60s), construit à partir
  de plusieurs scrapes (ex: 10s => 6 points agrégés en 1 valeur de séquence).
- **Baseline PRE** : snapshot des métriques capturé lors de `/trigger`.
- **Seuil industriel** : seuil de référence par métrique.
- **Seuil sécurisé** : `seuil industriel × 0.9`.
- **Tolérance** : pourcentage maximum de séquences autorisées en dépassement du seuil sécurisé.

## Métriques et percentiles
Utiliser les percentiles suivants pour l’analyse POST :
- `latency` -> p95
- `error_rate` -> p99
- `cpu_usage` -> p95
- `memory_usage` -> p99
- `requests_per_sec` -> p95

## Seuils sécurisés (règle x0.9)
Appliquer la règle : `seuil sécurisé = seuil industriel × 0.9`.

Exemples :
- latency : 300ms -> 270ms
- cpu_usage : 80% -> 72%
- memory_usage : 80% -> 72%
- error_rate : 1% -> 0.8%

## Tolérances (ratio max de dépassement)
Une métrique est valide si le ratio de séquences dépassant le seuil sécurisé
est inférieur ou égal à sa tolérance.

- latency(p95) <= 20%
- error_rate(p99) <= 5%
- cpu_usage(p95) <= 20%
- memory_usage(p99) <= 10%
- requests_per_sec(p95) <= 20%

## Cas spécial : requests_per_sec (deux seuils)
On sépare **la gravité d’une baisse** de **sa persistance**.

Entrées :
- `baseline_pre` (snapshot PRE)
- `seq_value` (valeur par séquence)

Calcul par séquence :
- `drop = (baseline_pre - seq_value) / baseline_pre`

Règles :
- **Seuil de gravité** : `drop > 20%` => séquence considérée “mauvaise”.
- **Tolérance de persistance** : max 20% de séquences “mauvaises”.

Cela évite de mélanger “combien c’est grave” et “combien de temps ça dure”.

## Règles de décision
Pour chaque métrique `m` :

1. Calculer le seuil sécurisé :
   - `seuil_securise[m] = seuil_industriel[m] * 0.9`

2. Pour chaque séquence `seq_values[m][i]` :
   - Si `m != requests_per_sec` :
     - `exceed_i = seq_values[m][i] > seuil_securise[m]`
   - Si `m == requests_per_sec` :
     - `drop_i = (baseline_pre[m] - seq_values[m][i]) / baseline_pre[m]`
     - `exceed_i = drop_i > 20%`

3. Calculer le ratio :
   - `exceed_ratio = count(exceed_i) / total_sequences`

4. Verdict de la métrique :
   - `metric_pass = exceed_ratio <= tolerance[m]`

Verdict final :
- `failed_metrics = {m | metric_pass[m] == false}`
- `critical_metrics = {error_rate, requests_per_sec}`
- si `failed_metrics` est vide:
  - `ok` seulement si qualité data suffisante (`score >= 0.90` et pas d'issues bloquantes),
  - sinon `warning` (qualité insuffisante pour confirmer la santé).
- si `failed_metrics` contient au moins une métrique critique:
  - `rollback_recommended`
- sinon:
  - `warning` (même avec plusieurs échecs non critiques).

## Complexité
- Temps : O(n) par métrique (n = nombre de séquences)
- Mémoire : O(1) ou O(n) selon streaming vs stockage des séquences

## Conformité NFR
- Performance : verdict < 1s après la fenêtre, SDH < 200ms
- Scale : 1000 projets, 100 métriques/projet, analyse O(n)
- Sécurité : pas de stockage long des raw metrics ; token par projet ; isolation tenant
- Fiabilité : verdict idempotent, retry‑safe
- Ownership : seuils configurables plus tard ; backward compatible

## Edge Cases
- Baseline PRE = 0 pour `requests_per_sec` :
  - Définir `drop = 0` (ou marquer “baseline insuffisante”) pour éviter division par zéro.
- Faible trafic pendant la fenêtre :
  - La tolérance empêche une seule séquence de casser le verdict.
- Séquences manquantes :
  - Si `pre/post` manquent : “insufficient data” (`warning`).
  - Si `pre/post` existent mais qualité insuffisante : blocage de `ok` en `warning`.

## Pseudocode
```pseudo
pour chaque métrique m:
  seuil_securise[m] = seuil_industriel[m] * 0.9
  exceed_count = 0
  total = nombre_de_sequences

  pour i dans 1..total:
    si m != requests_per_sec:
      exceed_i = seq_values[m][i] > seuil_securise[m]
    sinon:
      drop = (baseline_pre[m] - seq_values[m][i]) / baseline_pre[m]
      exceed_i = drop > 0.20
    si exceed_i:
      exceed_count += 1

  exceed_ratio = exceed_count / total
  si m == requests_per_sec:
    metric_pass[m] = exceed_ratio <= 0.20
  sinon:
    metric_pass[m] = exceed_ratio <= tolerance[m]

failed_metrics = {m | metric_pass[m] == false}
critical_metrics = {error_rate, requests_per_sec}

si failed_metrics est vide:
  si data_quality_score < 0.90 ou issues_qualite_bloquantes:
    verdict_final = warning
  sinon:
    verdict_final = ok
sinon si failed_metrics intersect critical_metrics != vide:
  verdict_final = rollback_recommended
sinon:
  verdict_final = warning
```

## Notes d’implémentation
- L’analyse s’exécute à la fin de la fenêtre d’observation (fin du workflow /finish).
- Le SDH est généré immédiatement après le verdict, sans persister les raw metrics.
- Garder la surface API existante (`/trigger`, `/finish`).
- Ne stocker que les agrégats nécessaires à l’audit/debug, pas les séquences brutes.

## Extensions futures (hors scope)
- Seuils dynamiques par projet
- Sampling adaptatif
- Analyse multi‑fenêtres / trend
- Score composite pondéré

## Comparatif Avant / Après (exemples chiffrés)

### Exemple 1 — Pic de latence bref
**Contexte** : 10 séquences de 60s. Seuil sécurisé latency = 270ms.  
Valeurs p95 : 9 séquences autour de 200ms, 1 séquence à 600ms.

- **Avant (moyenne)** : moyenne ≈ 240ms => verdict OK (le pic est lissé).  
- **Après (p95 + tolérance 20%)** : 1/10 = 10% des séquences > 270ms => OK mais le pic est visible, traçable et justifiable.

### Exemple 2 — Dégradation persistante
**Contexte** : 10 séquences, p95 latency = 280ms sur 4 séquences.  
- **Avant (moyenne)** : moyenne ≈ 240–250ms => verdict OK.  
- **Après** : 4/10 = 40% > 270ms => dépasse la tolérance 20% => `warning` (non‑critique).

### Exemple 3 — Baisse continue de trafic
**Contexte** : baseline PRE RPS = 100.  
- Séquences : 8 valeurs autour de 90, 2 valeurs à 70.  
- Seuil baisse = 20% (donc < 80 = séquence mauvaise).  
- Tolérance persistance = 20%.

- **Avant (moyenne)** : moyenne ≈ 86 => verdict OK sans distinguer la chute sévère.  
- **Après** : 2/10 = 20% de séquences en chute > 20% => limite acceptable.  
  Si 3 séquences à 70 => 30% => `rollback_recommended` (métrique critique).

### Exemple 4 — Erreur rare mais critique
**Contexte** : error_rate p99. Seuil sécurisé = 0.8%.  
- 1 séquence à 5%, 9 séquences à 0.2%.

- **Avant (moyenne)** : moyenne ≈ 0.68% => verdict OK.  
- **Après** : 1/10 = 10% de séquences > 0.8% => dépasse tolérance 5% => `rollback_recommended` (métrique critique).
