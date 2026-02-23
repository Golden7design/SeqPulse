# Plan

Mettre à jour l’analyse post‑déploiement pour passer à une logique percentile‑first avec seuil sécurisé + tolérances, tout en gardant les endpoints `/deployments/trigger` et `/deployments/finish` inchangés.

## Scope

- In:
  - Calcul des percentiles par métrique côté POST
  - Seuil sécurisé (x0.9) + tolérances par métrique
  - Logique spéciale `requests_per_sec` (seuil de baisse + tolérance de persistance)
  - Verdict final et génération SDH alignés sur le nouveau résultat
  - Tests unitaires et cas limites
- Out:
  - Changer la cadence de collecte ou la fenêtre d’observation
  - Seuils dynamiques par projet
  - Sampling adaptatif ou score composite

## Action Items

[x] Localiser le code d’analyse post‑déploiement (service/handler `/deployments/finish`) et identifier le pipeline de calcul actuel (moyenne + seuil industriel).
[x] Ajouter la configuration des percentiles par métrique et des tolérances dans un endroit central (constantes ou config). 
[x] Implémenter le calcul `secured_threshold = industrial_threshold * 0.9` pour chaque métrique.
[x] Remplacer la moyenne POST par le calcul de ratio de dépassement par séquence (percentile‑first).
[x] Implémenter la logique `requests_per_sec` avec deux seuils distincts:
    - seuil de baisse par séquence (20%)
    - tolérance de persistance (20%)
[x] Mettre à jour la construction du verdict final (`ALL(metric_pass)`), sans modifier l’API publique.
[x] Ajouter les cas limites: baseline PRE = 0, séquences manquantes, window trop courte.
[x] Adapter la génération SDH pour consommer le nouveau verdict sans stocker les raw metrics.
[x] Exposer les ratios de dépassement et tolérances dans le SDH.
[x] Ajuster le mapping warning/rollback selon criticité (error_rate ou requests_per_sec => rollback).
[x] Écrire des tests unitaires ciblés sur les exemples “avant/après” (pics brefs, dégradation persistante, baisse RPS).
[ ] Exécuter les tests backend pertinents et vérifier temps de calcul (<1s) sur dataset simulé.

## Validation

- `pytest -q` (ou sous‑suite pertinente si disponible)
- Vérifier 3 scénarios de référence:
  - Pic bref (latency p95) => OK
  - Dégradation persistante => KO
  - Baisse RPS au‑delà tolérance => KO

## Open Questions

- Souhaitez‑vous exposer les ratios de dépassement dans la réponse SDH (à des fins d’audit) ?
