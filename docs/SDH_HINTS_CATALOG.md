# Catalogue des Hints SDH (Self-Diagnosing Heuristics)

Ce document répertorie tous les cas de diagnostics automatisés (SDH Hints) générés par SeqPulse lors de l'analyse des déploiements.

## Cas Critiques (Composite - Multi-signaux)

### 1. Dégradation de service détectée
**Métriques déclencheuses :** `error_rate` + `latency_p95`

**Diagnostic :**
Le taux d'erreur et la latence ont augmenté après le déploiement, suggérant une dégradation majeure du service (probablement une défaillance en aval ou un épuisement des ressources).

**Actions suggérées :**
- Vérifier les logs d'application pour les erreurs 5xx ou exceptions
- Vérifier la connectivité à la base de données et les performances des requêtes
- Vérifier les dépendances API externes pour les timeouts ou défaillances
- Revoir les changements de code récents pour la gestion des erreurs ou la configuration des timeouts
- Envisager un rollback si les erreurs persistent après 5 minutes

---

### 2. Saturation de calcul suspectée
**Métriques déclencheuses :** `latency_p95` + `cpu_usage`

**Diagnostic :**
La latence et l'utilisation CPU ont augmenté après le déploiement, ce qui indique souvent une saturation du calcul, un code inefficace ou des opérations bloquantes.

**Actions suggérées :**
- Profiler le CPU pour identifier les méthodes ou boucles gourmandes (requêtes N+1, calculs lourds)
- Vérifier les opérations d'I/O bloquantes (appels DB synchrones, attentes API externes)
- Vérifier que les paramètres du pool de connexions ne sont pas épuisés
- Envisager le scaling horizontal si le CPU est constamment > 80%
- Revoir les changements de code récents pour les augmentations de complexité algorithmique

---

### 3. Panne partielle suspectée
**Métriques déclencheuses :** `error_rate` + `requests_per_sec` (chute de trafic)

**Diagnostic :**
Le taux d'erreur a augmenté tandis que le trafic a chuté significativement après le déploiement, suggérant une panne partielle, des health checks échoués ou une mauvaise configuration du routage.

**Actions suggérées :**
- Vérifier les health checks du load balancer (les instances sont-elles marquées unhealthy ?)
- Vérifier que les règles d'ingress/routage pointent vers la bonne version du service
- Vérifier les logs de démarrage de l'application pour les crash loops ou échecs d'initialisation
- Valider que les variables d'environnement et config maps sont correctement définies
- Envisager un rollback immédiat si > 50% du trafic est impacté

---

### 4. Violations critiques persistantes des seuils (Audit)
**Métriques déclencheuses :** Métriques critiques avec `exceed_ratio > tolerance`

**Diagnostic :**
Les métriques critiques violent de manière persistante les seuils sécurisés à travers les séquences post-déploiement (error rate, traffic).

**Actions suggérées :**
- Inspecter les séquences en échec dans l'audit des métriques
- Vérifier les changements récents de release et d'infrastructure
- Exécuter des vérifications ciblées de rollback pour les chemins impactés
- Effectuer un rollback si les violations critiques continuent

---

## Cas Individuels (Métrique unique)

### 5. Taux d'erreur élevé après déploiement
**Métrique :** `error_rate`

**Diagnostic :**
Le service retourne un nombre inhabituellement élevé d'erreurs après le déploiement, indiquant un possible bug d'application, défaillance de dépendance ou problème de configuration.

**Actions suggérées :**
- Vérifier les logs d'application pour les exceptions (NullPointer, erreurs de syntaxe, échecs d'import)
- Vérifier que les migrations de base de données se sont terminées avec succès
- Vérifier les dépendances de services externes (APIs, caches, files de messages)
- Revoir la configuration des variables d'environnement et secrets
- Envisager un rollback si le taux d'erreur > 10% pendant plus de 2 minutes

---

### 6. Latence élevée détectée
**Métrique :** `latency_p95`

**Diagnostic :**
Le temps de réponse a augmenté significativement après le déploiement, ce qui peut indiquer des requêtes de base de données lentes, une latence d'API externe ou une contention des ressources.

**Actions suggérées :**
- Vérifier les logs de requêtes lentes de la base de données pour les index manquants ou les scans complets de table
- Vérifier les temps de réponse et configurations de timeout des API externes
- Vérifier la pression mémoire causant des pauses GC ou du swap
- Activer le tracing distribué pour identifier les spans goulets d'étranglement
- Envisager un rollback si la latence p95 > 2x la baseline pendant 5+ minutes

---

### 7. Amélioration de la latence après déploiement
**Métrique :** `latency_p95` (amélioration)

**Diagnostic :**
Le temps de réponse a diminué après le déploiement, indiquant des optimisations de performance réussies dans la nouvelle version.

**Actions suggérées :**
- Documenter les optimisations réalisées
- Continuer à surveiller les tendances de performance
- Partager les meilleures pratiques avec les autres équipes

---

### 8. Pic d'utilisation CPU détecté
**Métrique :** `cpu_usage`

**Diagnostic :**
La consommation CPU a augmenté significativement après le déploiement, ce qui peut indiquer des algorithmes inefficaces, des boucles infinies ou une charge computationnelle accrue.

**Actions suggérées :**
- Profiler le CPU pour identifier les méthodes ou endpoints les plus gourmands
- Vérifier les problèmes de requêtes N+1 ou patterns d'accès base de données non optimisés
- Rechercher des boucles infinies ou appels récursifs sans terminaison
- Vérifier qu'il n'y a pas de crypto mining ou processus non autorisés en cours
- Envisager le scaling horizontal si augmentation légitime de la charge

---

### 9. Utilisation mémoire au-dessus du seuil
**Métrique :** `memory_usage`

**Diagnostic :**
La consommation mémoire a dépassé le seuil configuré, suggérant une possible fuite mémoire, un cache non limité ou une taille de tas insuffisante.

**Actions suggérées :**
- Vérifier les heap dumps pour les types d'objets en croissance (caches, connexions non fermées)
- Surveiller la fréquence de garbage collection et les temps de pause
- Revoir les changements récents pour les structures de données non limitées ou rétention d'objets volumineux
- Vérifier les fuites de connexions (DB, HTTP, descripteurs de fichiers non fermés)
- Envisager l'augmentation des limites mémoire ou l'implémentation de politiques d'éviction de cache

---

### 10. Utilisation mémoire approchant le seuil
**Métrique :** `memory_usage` (90-100% du seuil)

**Diagnostic :**
La consommation mémoire a augmenté après le déploiement et approche les limites critiques, ce qui peut impacter la stabilité du service.

**Actions suggérées :**
- Vérifier l'allocation du tas et la mémoire
- Revoir les changements de code récents
- Surveiller l'activité de garbage collection
- S'assurer que les limites mémoire sont correctement définies

---

### 11. Utilisation mémoire dans la plage normale
**Métrique :** `memory_usage` (stable, < 80%)

**Diagnostic :**
La consommation mémoire est stable et bien en dessous du seuil configuré, indiquant une utilisation saine des ressources après le déploiement.

**Actions suggérées :**
- Continuer à surveiller les tendances mémoire
- Aucune action immédiate requise
- Envisager l'optimisation si la tendance monte

---

### 12. Trafic inférieur à la baseline après déploiement
**Métrique :** `requests_per_sec` (chute significative)

**Diagnostic :**
Le trafic post-déploiement est significativement inférieur par rapport à la baseline pré-déploiement, sans forte augmentation d'erreur ou de latence détectée.

**Actions suggérées :**
- Comparer le trafic avec les périodes précédentes
- Vérifier la configuration de l'ingress ou du routage
- Vérifier la disponibilité des endpoints principaux
- Surveiller le taux d'erreur et la latence pour d'autres signaux

---

### 13. Violations persistantes des seuils (Audit individuel)
**Métriques :** `latency_p95`, `cpu_usage`, `memory_usage` avec `exceed_ratio > tolerance`

**Diagnostic :**
La métrique a dépassé le ratio de violation toléré à travers les séquences post-déploiement.

**Actions suggérées :**
- Revoir les métriques au niveau des séquences pour ce déploiement
- Comparer avec la baseline PRE et le seuil sécurisé
- Investiguer les changements récents de code et de configuration
- Scaler ou effectuer un rollback si la persistance reste élevée

---

## Cas de Secours

### 14. Verdict critique requiert investigation (Fallback)
**Déclencheur :** Violations critiques détectées mais aucun hint critique généré

**Diagnostic :**
Des violations critiques persistantes ont été détectées par l'audit des métriques mais aucun hint de diagnostic critique n'a été généré.

**Actions suggérées :**
- Inspecter les détails de l'audit des métriques pour ce déploiement
- Corréler les métriques en échec avec les logs/traces
- Valider la préparation au rollback

---

## Niveaux de Sévérité

| Sévérité | Description | Action attendue |
|----------|-------------|-----------------|
| **Critical** | Problème majeur nécessitant une action immédiate | Rollback recommandé ou investigation urgente |
| **Warning** | Anomalie à surveiller de près | Investigation et monitoring renforcé |
| **Info** | Information positive ou statut normal | Aucune action requise |

## Métriques surveillées

| Métrique | Description | Seuil industriel |
|----------|-------------|------------------|
| `error_rate` | Taux d'erreurs HTTP 5xx | > 1% |
| `latency_p95` | Latence au 95e percentile | > 500ms |
| `cpu_usage` | Utilisation CPU | > 70% |
| `memory_usage` | Utilisation mémoire | > 85% |
| `requests_per_sec` | Requêtes par seconde | Variable (baseline) |

---

*Document généré automatiquement à partir du code SDH - Dernière mise à jour : 2025*
