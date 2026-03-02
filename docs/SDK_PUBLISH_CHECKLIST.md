# SDK Publish Checklist (SeqPulse Node + Python)

## Derniere release

- npm: `seqpulse@0.2.0`
- PyPI: `seqpulse==0.2.0`

## 1) Preflight versions

```bash
node -v
npm -v
pnpm -v
python --version
```

Verifier alignement:

- `packages/seqpulse/package.json -> version`
- `packages/seqpulse-python/pyproject.toml -> project.version`

## 2) Gate Node (obligatoire)

Depuis `packages/seqpulse`:

```bash
npm run smoke
npm pack --dry-run
npm pack
```

Test install locale:

```bash
mkdir -p /tmp/seqpulse-smoke-node-publish && cd /tmp/seqpulse-smoke-node-publish
printf '{"name":"seqpulse-smoke-node-publish","version":"1.0.0"}\n' > package.json
npm i /ABS/PATH/TO/packages/seqpulse/seqpulse-<VERSION>.tgz
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

Test install locale:

```bash
pip install dist/*.whl
python -c "from seqpulse import SeqPulse; print(SeqPulse)"
```

## 4) Disponibilite package names

```bash
npm view seqpulse version
python -m pip index versions seqpulse
```

## 5) Auth publication

NPM token:

```bash
export NPM_TOKEN="..."
printf "//registry.npmjs.org/:_authToken=%s\n" "$NPM_TOKEN" > ~/.npmrc
npm whoami
```

PyPI token:

```bash
export TWINE_USERNAME="__token__"
export TWINE_PASSWORD="pypi-..."
```

## 6) Publication

Node:

```bash
cd packages/seqpulse
npm publish --access public
```

Python:

```bash
cd packages/seqpulse-python
python -m twine upload dist/seqpulse-<VERSION>*
```

## 7) Post-publication (obligatoire)

```bash
npm i seqpulse
pnpm add seqpulse
pip install seqpulse
```

Puis valider:

- endpoint SDK metrics (Node/FastAPI) repond bien
- HMAC actif/inactif fonctionne
- pipeline PRE/POST continue de fonctionner
