# Revue SDH - 2026-02-27

## Contexte
Analyse de `backend/app/analysis/sdh.py` et des fichiers liés (`engine.py`, routes/schemas SDH, modèles, tests, UI consommatrice).

## Avis global
La base est solide: code lisible, logique métier claire, bons tests unitaires ciblés.
Le principal point faible est un décalage entre:
- la logique qui décide le verdict (ratio de dépassement persistant),
- et la logique qui génère les hints SDH (moyennes agrégées vs seuils absolus).

## Findings (priorisés)

### 1) Décalage verdict vs hints SDH
- **Fichiers**:
  - `backend/app/analysis/sdh.py` (lignes ~91+)
  - `backend/app/analysis/engine.py` (lignes ~112+)
  - `backend/tests/test_analysis.py` (jeu de données de `test_analyze_deployment_flags_exceed_ratio_breaches`)
- **Sévérité**: High
- **Problème**:
  - `analyze_deployment` décide via `exceed_ratio` + `secured_threshold` + `tolerance`.
  - `generate_sdh_hints` déclenche surtout sur `post_agg` moyen comparé à `INDUSTRIAL_THRESHOLDS`.
  - Résultat possible: verdict `rollback_recommended` mais aucun hint SDH explicatif.
- **Preuve**:
  - Reproduction locale par exécution de `generate_sdh_hints` avec des valeurs issues du test d’analyse: `hints == []` malgré scénario de régression persistante côté verdict.
- **Amélioration proposée**:
  - Aligner les hints sur la même source de vérité que le verdict (`metrics_audit`, ratios, tolérances), pas seulement sur la moyenne agrégée.

### 2) Transaction non atomique (commits multiples)
- **Fichiers**:
  - `backend/app/analysis/engine.py` (`_create_verdict` commit interne + commit final)
  - `backend/app/analysis/sdh.py` (commit interne)
- **Sévérité**: Medium
- **Problème**:
  - Plusieurs `commit()` dans le flux d’analyse.
  - En cas d’exception tardive, état possible partiellement écrit (verdict/hints enregistrés, état deployment incohérent).
- **Amélioration proposée**:
  - Passer à une transaction atomique (un seul commit orchestré au niveau `analyze_deployment`).
  - Remplacer les commits internes par `flush()` si nécessaire.

### 3) Incohérence de baseline PRE entre moteur et API
- **Fichiers**:
  - `backend/app/analysis/engine.py` (baseline PRE = premier sample)
  - `backend/app/sdh/routes.py` (agrégats PRE/POST = moyenne)
- **Sévérité**: Medium
- **Problème**:
  - Les seuils/valeurs affichés dans l’UI SDH peuvent différer de ceux ayant réellement servi à la décision.
- **Amélioration proposée**:
  - Uniformiser la stratégie de baseline (first ou mean) entre moteur d’analyse et exposition API.
  - Documenter explicitement cette règle.

## Points positifs observés
- Validation d’entrée métriques robuste côté collector (valeurs finies + bornes).
- Données d’audit (`secured_threshold`, `exceed_ratio`, `tolerance`) déjà présentes en DB et API: bonne base pour convergence logique.
- UI composite déjà prête à afficher les signaux détaillés.

## Plan d’amélioration recommandé
1. **Aligner SDH sur `metrics_audit`**:
   - Générer les hints à partir des ratios/tolérances (et non uniquement des moyennes).
   - Garantir qu’un verdict critique soit accompagné d’au moins un hint critique explicatif.
2. **Rendre le flux atomique**:
   - Un commit en fin de traitement.
   - Gestion transactionnelle claire en cas d’erreur.
3. **Harmoniser la baseline PRE**:
   - Choix unique (first ou mean), appliqué partout.
4. **Renforcer les tests**:
   - Test d’intégration: cohérence verdict <-> hints.
   - Tests API SDH sur `composite_signals` et cohérence des seuils exposés.

## Limites de vérification
- Impossible d’exécuter `pytest` dans l’environnement courant (`pytest: command not found`).
- Les conclusions reposent sur lecture statique + reproduction ponctuelle via exécution Python ciblée.

