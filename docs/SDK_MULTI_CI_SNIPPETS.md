# SDK Multi-CI Snippets (Node CLI)

## Objectif

Snippets copy/paste pour integrer SeqPulse en CI/CD avec un YAML court, via la CLI du SDK Node (`seqpulse >= 0.4.0`).

Important:

- Le SDK runtime de l'app (`/seqpulse-metrics`) reste inchange.
- Ce document couvre uniquement la couche CI/CD (`trigger` puis `finish`).

## Variables CI communes

```bash
SEQPULSE_BASE_URL=https://api.seqpulse.dev
SEQPULSE_API_KEY=sp_xxx
SEQPULSE_METRICS_ENDPOINT=https://your-app.example.com/seqpulse-metrics
```

## Pattern commun

1. `trigger` avant le deploy.
2. Recuperer `deployment_id`.
3. `finish` en post-step (toujours), avec `success|failed`.
4. Mode par defaut non-bloquant.

---

## GitHub Actions

```yaml
name: deploy

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    env:
      SEQPULSE_BASE_URL: ${{ secrets.SEQPULSE_BASE_URL }}
      SEQPULSE_API_KEY: ${{ secrets.SEQPULSE_API_KEY }}
      SEQPULSE_METRICS_ENDPOINT: ${{ secrets.SEQPULSE_METRICS_ENDPOINT }}

    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20

      - run: npm ci
      - run: npm i --no-save seqpulse@0.4.0

      - name: SeqPulse trigger
        id: seqpulse_trigger
        run: |
          npx seqpulse ci trigger \
            --env prod \
            --branch "$GITHUB_REF_NAME" \
            --github-output "$GITHUB_OUTPUT"

      - name: Deploy app
        run: echo "Deploy your app here"

      - name: SeqPulse finish
        if: always()
        run: |
          npx seqpulse ci finish \
            --deployment-id "${{ steps.seqpulse_trigger.outputs.deployment_id }}" \
            --job-status "${{ job.status }}"
```

## GitLab CI

```yaml
stages: [deploy]

deploy_prod:
  stage: deploy
  image: node:20
  script:
    - npm ci
    - npm i --no-save seqpulse@0.4.0
    - npx seqpulse ci trigger --env prod --branch "$CI_COMMIT_REF_NAME" > .seqpulse_trigger.json
    - export SEQPULSE_DEPLOYMENT_ID=$(node -e 'const fs=require("fs");const o=JSON.parse(fs.readFileSync(".seqpulse_trigger.json","utf8"));process.stdout.write(o.deploymentId||"")')
    - echo "Deploy your app here"
  after_script:
    - npx seqpulse ci finish --deployment-id "$SEQPULSE_DEPLOYMENT_ID" --job-status "$CI_JOB_STATUS"
```

## CircleCI

```yaml
version: 2.1

jobs:
  deploy:
    docker:
      - image: cimg/node:20.10
    steps:
      - checkout
      - run: npm ci
      - run: npm i --no-save seqpulse@0.4.0
      - run:
          name: SeqPulse trigger
          command: |
            npx seqpulse ci trigger --env prod --branch "$CIRCLE_BRANCH" > .seqpulse_trigger.json
            node -e 'const fs=require("fs");const o=JSON.parse(fs.readFileSync(".seqpulse_trigger.json","utf8"));fs.writeFileSync(".seqpulse_deployment_id", o.deploymentId || "")'
      - run: echo "Deploy your app here"
      - run:
          name: SeqPulse finish
          when: always
          command: |
            export SEQPULSE_DEPLOYMENT_ID=$(cat .seqpulse_deployment_id 2>/dev/null || true)
            npx seqpulse ci finish --deployment-id "$SEQPULSE_DEPLOYMENT_ID" --job-status "${SEQPULSE_PIPELINE_STATUS:-success}"

workflows:
  deploy:
    jobs:
      - deploy
```

## Jenkins (declarative)

```groovy
pipeline {
  agent any
  environment {
    SEQPULSE_BASE_URL = credentials('seqpulse_base_url')
    SEQPULSE_API_KEY = credentials('seqpulse_api_key')
    SEQPULSE_METRICS_ENDPOINT = credentials('seqpulse_metrics_endpoint')
  }
  stages {
    stage('Install') {
      steps {
        sh 'npm ci'
        sh 'npm i --no-save seqpulse@0.4.0'
      }
    }
    stage('SeqPulse Trigger') {
      steps {
        sh 'npx seqpulse ci trigger --env prod --branch "$BRANCH_NAME" > .seqpulse_trigger.json'
        sh 'node -e "const fs=require(\"fs\");const o=JSON.parse(fs.readFileSync(\".seqpulse_trigger.json\",\"utf8\"));fs.writeFileSync(\".seqpulse_deployment_id\", o.deploymentId || \"\")"'
      }
    }
    stage('Deploy') {
      steps {
        sh 'echo "Deploy your app here"'
      }
    }
  }
  post {
    always {
      sh 'SEQPULSE_DEPLOYMENT_ID=$(cat .seqpulse_deployment_id 2>/dev/null || true); npx seqpulse ci finish --deployment-id "$SEQPULSE_DEPLOYMENT_ID" --job-status "$BUILD_RESULT"'
    }
  }
}
```
