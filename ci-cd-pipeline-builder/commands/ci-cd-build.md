---
name: ci-cd-build
description: Build CI/CD pipelines for GitHub Actions, Gitea Actions, GitLab CI, Jenkins, and more
---
# CI/CD Pipeline Builder

Generate production-ready CI/CD pipelines for multiple platforms.

## Pipeline Patterns

1. **Test Stage**: Unit, integration, E2E tests
2. **Build Stage**: Compile, bundle, containerize
3. **Security Stage**: Vulnerability scanning, SAST/DAST
4. **Deploy Stage**: Staging and production deployment
5. **Monitoring**: Pipeline metrics and alerts

## Platform Selection

Before generating a pipeline, determine the target platform:

- **GitHub Actions** — `.github/workflows/` YAML files, GitHub-hosted or self-hosted runners
- **Gitea Actions** — `.gitea/workflows/` or `.github/workflows/` YAML files, uses act runner (see Gitea-specific notes below)
- **GitLab CI** — `.gitlab-ci.yml`, GitLab runners
- **Jenkins** — `Jenkinsfile`, Jenkins agents

## GitHub Actions Example

```yaml
name: CI/CD Pipeline

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

env:
  NODE_VERSION: '18'
  REGISTRY: ghcr.io

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Run linter
        run: npm run lint

      - name: Run tests
        run: npm test -- --coverage

      - name: Upload coverage
        uses: codecov/codecov-action@v3

  security:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Run Trivy vulnerability scanner
        uses: aquasecurity/trivy-action@master
        with:
          scan-type: 'fs'
          severity: 'CRITICAL,HIGH'

      - name: Run CodeQL analysis
        uses: github/codeql-action/analyze@v2

  build:
    needs: [test, security]
    runs-on: ubuntu-latest
    permissions:
      contents: read
      packages: write
    steps:
      - uses: actions/checkout@v4

      - name: Set up Docker Buildx
        uses: docker/setup-buildx-action@v3

      - name: Log in to Container Registry
        uses: docker/login-action@v3
        with:
          registry: ${{ env.REGISTRY }}
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}

      - name: Extract metadata
        id: meta
        uses: docker/metadata-action@v5
        with:
          images: ${{ env.REGISTRY }}/${{ github.repository }}
          tags: |
            type=ref,event=branch
            type=ref,event=pr
            type=semver,pattern={{version}}
            type=sha,prefix={{branch}}-

      - name: Build and push Docker image
        uses: docker/build-push-action@v5
        with:
          context: .
          push: true
          tags: ${{ steps.meta.outputs.tags }}
          labels: ${{ steps.meta.outputs.labels }}
          cache-from: type=gha
          cache-to: type=gha,mode=max

  deploy-staging:
    needs: build
    if: github.ref == 'refs/heads/develop'
    runs-on: ubuntu-latest
    environment:
      name: staging
      url: https://staging.example.com
    steps:
      - name: Deploy to Kubernetes
        run: |
          kubectl set image deployment/app \
            app=${{ env.REGISTRY }}/${{ github.repository }}:develop-${{ github.sha }} \
            --namespace=staging

  deploy-production:
    needs: build
    if: github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    environment:
      name: production
      url: https://example.com
    steps:
      - name: Deploy to Kubernetes
        run: |
          kubectl set image deployment/app \
            app=${{ env.REGISTRY }}/${{ github.repository }}:main-${{ github.sha }} \
            --namespace=production

      - name: Notify deployment
        uses: slackapi/slack-github-action@v1
        with:
          webhook-url: ${{ secrets.SLACK_WEBHOOK }}
          payload: |
            {
              "text": "Production deployment successful!"
            }
```

## Gitea Actions Example

Gitea Actions is largely compatible with GitHub Actions but has key differences.
Place workflows in `.gitea/workflows/` (preferred) or `.github/workflows/`.

```yaml
name: CI/CD Pipeline

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

env:
  NODE_VERSION: '18'
  # Gitea uses its own container registry — adjust accordingly
  REGISTRY: your-gitea.example.com

jobs:
  test:
    # Gitea only supports simple runs-on values, not complex label matching
    runs-on: ubuntu-latest
    steps:
      # On Gitea you can use absolute URLs for actions hosted anywhere:
      #   uses: https://github.com/actions/checkout@v4
      # or reference actions from your own Gitea instance:
      #   uses: https://your-gitea.example.com/owner/action@v1
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Run linter
        run: npm run lint

      - name: Run tests
        run: npm test -- --coverage

  security:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Run Trivy vulnerability scanner
        uses: aquasecurity/trivy-action@master
        with:
          scan-type: 'fs'
          severity: 'CRITICAL,HIGH'
      # NOTE: github/codeql-action is NOT available on Gitea.
      # Use alternative SAST tools (e.g., Trivy, Semgrep) instead.

  build:
    needs: [test, security]
    runs-on: ubuntu-latest
    # NOTE: 'permissions' block is IGNORED by Gitea — it has no effect.
    # Use secrets or PATs for registry authentication instead.
    steps:
      - uses: actions/checkout@v4

      - name: Set up Docker Buildx
        uses: docker/setup-buildx-action@v3

      - name: Log in to Container Registry
        uses: docker/login-action@v3
        with:
          registry: ${{ env.REGISTRY }}
          username: ${{ secrets.REGISTRY_USER }}
          # Gitea's automatic GITEA_TOKEN cannot push to package registries.
          # Use a Personal Access Token (PAT) stored as a secret instead.
          password: ${{ secrets.REGISTRY_PASSWORD }}

      - name: Build and push Docker image
        uses: docker/build-push-action@v5
        with:
          context: .
          push: true
          tags: ${{ env.REGISTRY }}/${{ github.repository }}:${{ github.sha }}

  deploy-staging:
    needs: build
    if: github.ref == 'refs/heads/develop'
    runs-on: ubuntu-latest
    # NOTE: 'environment' is IGNORED by Gitea — no deployment environments UI.
    # Manage environment separation through secrets naming conventions instead.
    steps:
      - name: Deploy to staging
        run: |
          kubectl set image deployment/app \
            app=${{ env.REGISTRY }}/${{ github.repository }}:${{ github.sha }} \
            --namespace=staging

  deploy-production:
    needs: build
    if: github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    steps:
      - name: Deploy to production
        run: |
          kubectl set image deployment/app \
            app=${{ env.REGISTRY }}/${{ github.repository }}:${{ github.sha }} \
            --namespace=production
```

### Gitea Actions vs GitHub Actions — Key Differences

When generating pipelines for Gitea Actions, apply these rules:

| Feature | GitHub Actions | Gitea Actions |
|---------|---------------|---------------|
| Workflow location | `.github/workflows/` | `.gitea/workflows/` (preferred) or `.github/workflows/` |
| Action references | `owner/repo@ref` | Same, plus absolute URLs like `https://github.com/actions/checkout@v4` or `https://your-gitea.example.com/owner/action@v1` |
| `concurrency` | Supported | **Ignored** |
| `permissions` | Controls token scope | **Ignored** — use PATs or secrets for elevated access |
| `timeout-minutes` | Supported | **Ignored** |
| `continue-on-error` | Supported | **Ignored** |
| `environment` | Deployment environments UI | **Ignored** — no environment protection rules |
| `runs-on` | Complex label expressions | **Simple values only** — `runs-on: ubuntu-latest` or `runs-on: [label]` |
| Package registry auth | `GITHUB_TOKEN` with packages scope | `GITEA_TOKEN` **cannot** publish to package registries — use PATs |
| Problem matchers | Supported | **Ignored** |
| Error annotations | Supported | **Ignored** |
| Status functions | `success()`, `failure()`, `cancelled()`, `always()` | Only `always()` is supported |
| Cron schedules | Standard cron | Standard cron **plus** `@yearly`, `@monthly`, `@weekly`, `@daily`, `@hourly` |
| Go-based actions | Not supported | **Supported** — actions can be written in Go |
| CodeQL | `github/codeql-action` | **Not available** — use Trivy, Semgrep, or other SAST tools |
| Cache action | `actions/cache@v4` (GHA backend) | Works but cache backend depends on runner config |

### Gitea Actions Checklist

When building a pipeline for Gitea Actions:

1. Place workflows in `.gitea/workflows/` (not `.github/workflows/`)
2. Remove or comment out `concurrency`, `permissions`, `timeout-minutes`, `continue-on-error`, and `environment` blocks (they are silently ignored)
3. Replace `GITHUB_TOKEN` package registry auth with PAT-based secrets
4. Replace `github/codeql-action` with alternative SAST (Trivy, Semgrep)
5. Keep `runs-on` values simple — no complex label matching
6. Do not rely on `success()`, `failure()`, or `cancelled()` status functions — only `always()` works
7. Consider using absolute action URLs if referencing actions from external sources
8. Leverage Gitea-specific cron shortcuts (`@daily`, `@hourly`, etc.) if useful

## GitLab CI Example

```yaml
stages:
  - test
  - build
  - deploy

variables:
  DOCKER_DRIVER: overlay2
  DOCKER_TLS_CERTDIR: "/certs"

test:
  stage: test
  image: node:18
  cache:
    paths:
      - node_modules/
  script:
    - npm ci
    - npm run lint
    - npm test
  coverage: '/Lines\s*:\s*(\d+\.\d+)%/'
  artifacts:
    reports:
      coverage_report:
        coverage_format: cobertura
        path: coverage/cobertura-coverage.xml

security:
  stage: test
  image: aquasec/trivy:latest
  script:
    - trivy fs --severity HIGH,CRITICAL .

build:
  stage: build
  image: docker:latest
  services:
    - docker:dind
  script:
    - docker build -t $CI_REGISTRY_IMAGE:$CI_COMMIT_SHA .
    - docker push $CI_REGISTRY_IMAGE:$CI_COMMIT_SHA

deploy:production:
  stage: deploy
  image: bitnami/kubectl:latest
  script:
    - kubectl set image deployment/app app=$CI_REGISTRY_IMAGE:$CI_COMMIT_SHA
  only:
    - main
  environment:
    name: production
    url: https://example.com
```

## When Invoked

1. Ask the user which CI/CD platform they need (GitHub Actions, Gitea Actions, GitLab CI, Jenkins)
2. If the user says "GitHub Actions", ask if they might also need Gitea Actions compatibility
3. Generate complete pipeline configurations with best practices for the chosen platform
4. If Gitea Actions is selected, apply all compatibility rules from the checklist above
