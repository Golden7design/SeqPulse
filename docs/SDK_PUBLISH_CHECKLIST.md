# SDK Publish Checklist (SeqPulse Node + Python)

## 0) État actuel (local)

- Node smoke test: OK
- Node `npm pack --dry-run`: OK
- Node `npm pack` (tarball généré): OK (`seqpulse-0.1.0.tgz`)
- Test installation locale npm depuis tarball: OK
- Test installation locale pnpm depuis tarball: OK
- Python smoke test (`python scripts/smoke.py`): OK
- Python build (`python -m build`): OK
- Python twine check (`python -m twine check dist/*`): OK

## 1) Préflight versions

```bash
node -v
npm -v
pnpm -v
python --version
```

Vérifier alignement version:
- `packages/seqpulse/package.json -> version`
- `packages/seqpulse-python/pyproject.toml -> project.version`

## 2) Gate Node (obligatoire)

Depuis `packages/seqpulse`:

```bash
npm run smoke
npm pack --dry-run
npm pack
```

Test consommateur local:

```bash
mkdir -p /tmp/seqpulse-smoke-node-publish && cd /tmp/seqpulse-smoke-node-publish
printf '{"name":"seqpulse-smoke-node-publish","version":"1.0.0"}\n' > package.json
npm i /ABS/PATH/TO/packages/seqpulse/seqpulse-0.1.0.tgz
node -e "const s=require('seqpulse'); console.log(Object.keys(s))"
```

Option pnpm:

```bash
pnpm add /ABS/PATH/TO/packages/seqpulse/seqpulse-0.1.0.tgz
node -e "const s=require('seqpulse'); console.log(Object.keys(s))"
```

## 3) Gate Python (obligatoire)

Depuis `packages/seqpulse-python`:

```bash
python -m venv .venv
source .venv/bin/activate
python -m pip install -U pip build twine
python scripts/smoke.py
python -m build
python -m twine check dist/*
```

Test installation locale wheel/sdist:

```bash
pip install dist/*.whl
python -c "from seqpulse import SeqPulse; print(SeqPulse)"
```

Option offline (si dépendances déjà présentes):

```bash
pip install --no-deps dist/*.whl
python -c "from seqpulse import SeqPulse; print(SeqPulse)"
```

## 4) Vérifier disponibilité des noms

NPM:

```bash
npm view seqpulse version
```

PyPI:

```bash
python -m pip index versions seqpulse
```

Si déjà pris:
- npm: utiliser un scope (`@seqpulse/seqpulse`)
- PyPI: renommer (ex: `seqpulse-sdk`)

## 5) Auth publication

NPM:

```bash
npm login
npm whoami
```

PyPI:

```bash
python -m pip install -U twine
python -m twine upload --repository pypi dist/*
```

Recommandé: token PyPI (`__token__`) au lieu d'un mot de passe.

## 6) Publication

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

## 7) Post-publication (obligatoire)

```bash
npm i seqpulse
pnpm add seqpulse
pip install seqpulse
```

Puis valider un mini exemple backend (Express + FastAPI/Starlette) avec endpoint `/seqpulse-metrics`.
