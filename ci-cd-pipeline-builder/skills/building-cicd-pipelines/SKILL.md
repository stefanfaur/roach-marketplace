---
name: building-cicd-pipelines
description: |
  Use when you need to work with deployment and CI/CD.
  This skill provides deployment automation and pipeline orchestration with comprehensive guidance.
  Trigger with phrases like "deploy application", "create pipeline", "automate deployment",
  "GitHub Actions", "Gitea Actions", "GitLab CI", or "Jenkins pipeline".

allowed-tools: Read, Write, Edit, Grep, Glob, Bash(git:*), Bash(docker:*), Bash(kubectl:*)
version: 1.1.0
author: Jeremy Longshore <jeremy@intentsolutions.io>
license: MIT
---
# CI/CD Pipeline Builder

This skill provides automated assistance for building CI/CD pipelines across multiple platforms.

## Supported Platforms

- **GitHub Actions** — `.github/workflows/` YAML, GitHub-hosted or self-hosted runners
- **Gitea Actions** — `.gitea/workflows/` YAML, act-based runners (largely GitHub Actions compatible with important differences)
- **GitLab CI** — `.gitlab-ci.yml`, GitLab runners
- **Jenkins** — `Jenkinsfile`, Jenkins agents

## Prerequisites

Before using this skill, ensure:
- Required credentials and permissions for the target CI/CD platform
- Understanding of the project's build, test, and deployment requirements
- Access to relevant documentation and configuration files
- Container registry credentials if building/pushing images
- Kubernetes or deployment target access if deploying

## Instructions

### Step 1: Determine Platform and Requirements
1. Identify which CI/CD platform the project uses or needs
2. **If GitHub Actions is selected, ask whether Gitea Actions compatibility is also needed**
3. Review the project structure (language, framework, build tool)
4. Identify deployment targets (Kubernetes, cloud provider, bare metal)
5. Document security requirements (scanning, secrets management)

### Step 2: Design Pipeline Architecture
1. Define pipeline stages: test, build, security, deploy
2. Choose appropriate runner images and configurations
3. Plan caching strategy for dependencies
4. Design environment promotion (dev -> staging -> production)
5. If targeting Gitea Actions, review the compatibility rules below

### Step 3: Implement Pipeline
1. Create workflow files in the correct location for the platform
2. Configure triggers (push, PR, schedule, manual)
3. Set up secrets and environment variables
4. Implement all pipeline stages with proper error handling
5. Add deployment gates and approvals where supported

### Step 4: Validate Pipeline
1. Check YAML syntax
2. Verify all referenced actions/images exist and are pinned to versions
3. Test pipeline in a non-production branch first
4. Verify secrets are properly configured in the platform
5. If Gitea: confirm no unsupported features are relied upon

### Step 5: Deploy and Monitor
1. Merge pipeline to main branch
2. Monitor first few pipeline runs for issues
3. Verify deployment targets receive correct artifacts
4. Set up notifications for pipeline failures
5. Document the pipeline for the team

## Gitea Actions Compatibility Rules

When building pipelines that target Gitea Actions (or need dual GitHub/Gitea compatibility), apply these rules:

### Ignored Syntax (silently ignored by Gitea — remove or comment out)
- `concurrency` — no concurrency control
- `permissions` / `jobs.<job_id>.permissions` — no token scope control
- `jobs.<job_id>.timeout-minutes` — no job timeout
- `jobs.<job_id>.continue-on-error` — no error continuation
- `jobs.<job_id>.environment` — no deployment environments UI

### Behavioral Differences
- **Workflow location**: Use `.gitea/workflows/` (preferred) or `.github/workflows/`
- **`runs-on`**: Only simple values (`runs-on: ubuntu-latest` or `runs-on: [label]`), no complex label expressions
- **Action references**: Can use absolute URLs (`uses: https://github.com/actions/checkout@v4` or `uses: https://your-gitea.example.com/owner/action@v1`)
- **Status functions**: Only `always()` works — `success()`, `failure()`, `cancelled()` are unsupported
- **Cron**: Supports standard cron plus `@yearly`, `@monthly`, `@weekly`, `@daily`, `@hourly`
- **Go actions**: Gitea supports writing actions in Go (GitHub does not)

### Missing Features
- **Package registry auth**: `GITEA_TOKEN` cannot publish to package registries — use Personal Access Tokens (PATs)
- **Problem matchers**: Regex-based output scanning is ignored
- **Error annotations**: Workflow commands for annotations are ignored
- **CodeQL**: `github/codeql-action` is not available — use Trivy, Semgrep, or other SAST tools
- **Cache**: `actions/cache` works but the backend depends on runner configuration

### Gitea Pipeline Checklist
1. Place workflows in `.gitea/workflows/`
2. Remove `concurrency`, `permissions`, `timeout-minutes`, `continue-on-error`, `environment` blocks
3. Replace `GITHUB_TOKEN` package auth with PAT-based secrets
4. Replace `github/codeql-action` with Trivy or Semgrep
5. Keep `runs-on` values simple
6. Only use `always()` for status checks
7. Use absolute action URLs when referencing external actions
8. Leverage Gitea-specific cron shortcuts if useful

## Output

This skill produces:

**Pipeline Configuration Files**: Complete workflow YAML files ready to commit

**Documentation**: Inline comments explaining each stage and configuration choice

**Security Configuration**: Scanning stages, secrets management, and access controls

**Deployment Stages**: Environment-specific deployment configurations

## Error Handling

**Action Not Found**:
- Verify action repository exists and is accessible from the runner
- For Gitea: try absolute URL syntax (`uses: https://github.com/owner/action@tag`)
- Pin actions to specific versions or SHA for reliability

**Registry Authentication Failures**:
- For GitHub: verify `GITHUB_TOKEN` permissions
- For Gitea: use PAT stored as secret (GITEA_TOKEN cannot push to package registries)
- Verify registry URL is correct

**Runner Issues**:
- Verify runner labels match `runs-on` values
- For Gitea: keep `runs-on` simple — no complex expressions
- Check runner connectivity and available resources

## Resources

**GitHub Actions Documentation**: https://docs.github.com/en/actions
**Gitea Actions Documentation**: https://docs.gitea.com/usage/actions/overview
**Gitea vs GitHub Comparison**: https://docs.gitea.com/usage/actions/comparison
**GitLab CI Documentation**: https://docs.gitlab.com/ee/ci/
