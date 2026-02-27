# Maintenance SDK SeqPulse (Node + Python)

## 1) Objectif

Maintenir les SDK `seqpulse` (npm/pnpm) et `seqpulse` (PyPI) stables, prévisibles et alignés sur le contrat produit.

Scope SDK:
- exposition des métriques
- structure métriques attendue par SeqPulse
- sécurité HMAC

Hors scope SDK:
- pipeline CI/CD (reste indépendant)

## 2) Source of truth

Avant toute modification, vérifier:
- `docs/SDK_SEQPULSE.md`
- `docs/SDK_INTEGRATION_FLOW.md`
- `docs/SDK_PUBLISH_CHECKLIST.md`

Règle: un changement fonctionnel SDK doit être cohérent dans Node et Python (sauf raison documentée).

## 3) Cadence maintenance

### Hebdomadaire

1. Vérifier dépendances et vulnérabilités.
2. Exécuter smoke tests Node/Python.
3. Vérifier que les snippets d'intégration restent valides.

### Mensuelle

1. Revue compatibilité runtimes:
- Node 18/20/22
- Python 3.10/3.11/3.12
2. Revue DX (README, exemples, onboarding).
3. Revue tickets bugs récurrents + plan correctif.

## 4) Gates qualité obligatoires

### Node

Depuis `packages/seqpulse`:

```bash
npm run smoke
npm pack --dry-run
npm pack
```

### Python

Depuis `packages/seqpulse-python`:

```bash
python scripts/smoke.py
python -m build
python -m twine check dist/*
```

### Contrat fonctionnel minimal (les 2 SDK)

Valider à chaque release:
- endpoint métriques répond en 200
- payload contient:
  - `requests_per_sec`
  - `latency_p95`
  - `error_rate`
  - `cpu_usage`
  - `memory_usage`
- HMAC:
  - requête valide => 200
  - nonce rejoué => 401
  - timestamp hors fenêtre => 401

## 5) Versioning & compatibilité

Utiliser SemVer:
- `PATCH`: bugfix sans changement d'API
- `MINOR`: ajout rétrocompatible
- `MAJOR`: breaking change

Politique:
- aligner la version Node/Python quand le comportement change côté contrat SDK
- documenter les changements dans changelog release
- annoncer une dépréciation avant suppression d'API

## 6) Procédure de release

### Pré-release

1. Mettre à jour versions:
- `packages/seqpulse/package.json`
- `packages/seqpulse-python/pyproject.toml`
2. Exécuter les gates qualité.
3. Vérifier disponibilité/ownership des noms package.

### Publication

Node:

```bash
cd packages/seqpulse
npm publish --access public
```

Python:

```bash
cd packages/seqpulse-python
python -m twine upload dist/*
```

### Post-release

1. Vérifier install publique:

```bash
npm install seqpulse
pnpm add seqpulse
pip install seqpulse
```

2. Vérifier mini intégration Express/FastAPI.
3. Tag git release (`sdk-vX.Y.Z`).

## 7) Hotfix process

1. Reproduire bug sur test minimal.
2. Fix Node + Python (ou documenter pourquoi un seul SDK).
3. Refaire gates qualité.
4. Publier patch `X.Y.Z+1`.
5. Documenter cause et prévention.

## 8) Check-list "Done"

Une release SDK est "Done" si:
- Node + Python publiés
- tests smoke OK
- `build/twine check` OK
- install npm/pnpm/pip validée
- doc SDK à jour
- changelog/tag release créé

