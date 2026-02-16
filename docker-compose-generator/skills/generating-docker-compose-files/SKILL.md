---
name: generating-docker-compose-files
description: |
  Use when you need to work with Docker Compose or Podman Compose.
  This skill provides compose file generation with comprehensive guidance for both Docker and Podman runtimes.
  Trigger with phrases like "generate docker-compose", "create compose file",
  "configure multi-container app", "podman compose", or "generate podman compose".

allowed-tools: Read, Write, Edit, Grep, Glob, Bash(docker:*), Bash(podman:*), Bash(kubectl:*)
version: 1.1.0
author: Jeremy Longshore <jeremy@intentsolutions.io>
license: MIT
---
# Docker/Podman Compose Generator

This skill generates production-ready compose files for both Docker Compose and Podman Compose.

## Supported Runtimes

- **Docker Compose** (`docker compose`) — Docker daemon, bridge networking, service-name DNS
- **Podman Compose** — Two variants:
  - `podman compose` (built-in wrapper, delegates to docker-compose or podman-compose)
  - `podman-compose` (Python package, translates compose spec to Podman CLI)

## Prerequisites

Before using this skill, ensure:
- Docker or Podman is installed on the target system
- Understanding of the application's service dependencies
- Access to container images or Dockerfiles/Containerfiles
- Knowledge of target OS for SELinux considerations (Podman on RHEL/Fedora/CentOS)

## Instructions

### Step 1: Determine Runtime and Environment
1. Ask which container runtime: Docker or Podman
2. If Podman: determine if rootless (default) or rootful
3. If Podman: determine OS family (RHEL/Fedora need SELinux volume labels)
4. Identify which compose tool: `docker compose`, `podman compose`, or `podman-compose`
5. Identify the application architecture (services, databases, caches, proxies)

### Step 2: Design Compose Architecture
1. Define all services and their dependencies
2. Plan networking strategy (custom bridge networks for DNS resolution)
3. Plan volume strategy (named volumes for persistence, bind mounts for config)
4. Define health checks for all services
5. Plan environment variable and secrets management

### Step 3: Generate Compose File
1. Write compose file in Compose Specification format (no `version:` key)
2. Apply runtime-specific adaptations (see Podman rules below)
3. Include health checks, restart policies, and resource limits
4. Add inline comments explaining non-obvious configuration choices
5. Generate `.env` file template for environment variables

### Step 4: Validate
1. Validate YAML syntax
2. Check that all referenced images and build contexts exist
3. Verify port mappings don't conflict
4. Test `docker compose config` or `podman compose config`
5. If Podman: verify SELinux labels, rootless port restrictions, DNS setup

## Podman Compose Compatibility Rules

When generating for Podman, apply these adaptations:

### Architecture Differences
- **Pod-based networking**: Podman groups all compose services into a pod sharing a network namespace
- **Daemonless**: No background daemon — containers run as direct child processes
- **Rootless by default**: Runs as unprivileged user with user namespace UID/GID mapping

### Compose File Adaptations

**Ports (rootless)**:
- Cannot bind to ports < 1024 by default
- Map to high ports (e.g., `8080:80` instead of `80:80`) or document the sysctl:
  ```
  # To allow low ports: sysctl -w net.ipv4.ip_unprivileged_port_start=80
  ```

**Volumes (SELinux)**:
- On RHEL/Fedora/CentOS, bind mounts need SELinux labels:
  - `:z` — shared label (multiple containers can access)
  - `:Z` — private label (single container, exclusive)
  ```yaml
  volumes:
    - ./config:/app/config:z    # shared
    - ./data:/app/data:Z        # private to this container
  ```
- Use `:U` to auto-chown volumes for rootless UID mapping:
  ```yaml
  volumes:
    - ./uploads:/app/uploads:U  # auto-chown to container user
  ```

**Networking**:
- Always define custom bridge networks — the default `podman` network does NOT support DNS resolution
- Custom networks enable container-to-container name resolution via the dnsname plugin
  ```yaml
  networks:
    app-net:
      driver: bridge  # DNS enabled by default on custom networks
  ```

**Unsupported/Limited Features**:
- `deploy.replicas` — no Swarm equivalent, remove entirely
- `deploy.resources` — works via `podman compose` (docker-compose backend), may be ignored by `podman-compose`
- `network_mode: host` — known issues when combined with multiple networks
- Multiple `env_file` entries — `podman-compose` only supports a single `--env-file`; `podman compose` handles multiple

**`depends_on` with health checks**:
- `condition: service_healthy` requires Podman >= 4.6.0 and recent podman-compose
- Fall back to startup ordering without health conditions on older versions

**Build context**:
- Podman natively uses `Containerfile` but accepts `Dockerfile`
- Additional build contexts (Docker Compose v2+ feature) are NOT supported in podman-compose

### Podman Compose Checklist
1. Drop `version:` key — use Compose Specification format
2. Map privileged ports (< 1024) to high ports for rootless
3. Add `:z`/`:Z` SELinux suffixes on bind mounts for RHEL-based systems
4. Add `:U` suffix where rootless UID mapping causes permission issues
5. Define custom bridge networks for DNS — never rely on default `podman` network
6. Remove `deploy.replicas` and Swarm-specific config
7. Test `depends_on` with health conditions only on Podman >= 4.6.0
8. Limit to single `env_file` per service with `podman-compose`
9. For production: generate systemd units via `podman generate systemd` or Quadlet
10. Consider `podman generate kube` for Kubernetes migration path

### `podman compose` vs `podman-compose`

| | `podman compose` | `podman-compose` |
|---|---|---|
| Type | Built-in Podman wrapper | Standalone Python package |
| Backend | Delegates to docker-compose or podman-compose | Direct Podman CLI translation |
| Feature coverage | Full (when using docker-compose backend) | Subset of Compose spec |
| Resource limits | Supported | May be ignored |
| Multiple env_file | Supported | Single only |
| Recommendation | Maximum compatibility | Lightweight, Podman-native |

## Output

This skill produces:

**Compose Files**: Complete `compose.yaml` (or `docker-compose.yml`) ready to use

**Environment Templates**: `.env.example` with all extracted variables and safe defaults

**Documentation**: Inline comments explaining runtime-specific decisions

**Validation**: Syntax and configuration verification

## Error Handling

**Port Conflicts**:
- Check for duplicate host port mappings across services
- For Podman rootless: verify port is >= 1024 or sysctl is configured

**Volume Permission Errors**:
- For Podman rootless: add `:U` suffix or use `podman unshare` to fix ownership
- For SELinux: add `:z` or `:Z` suffix to bind mounts

**DNS Resolution Failures (Podman)**:
- Verify containers are on a custom bridge network, not the default `podman` network
- Check that the dnsname plugin is installed

**Health Check Failures**:
- Verify the health check command is available inside the container
- Adjust intervals and retries for slow-starting services

## Resources

**Docker Compose Specification**: https://docs.docker.com/compose/compose-file/
**Podman Compose**: https://docs.podman.io/en/latest/markdown/podman-compose.1.html
**Podman Rootless Guide**: https://github.com/containers/podman/blob/main/docs/tutorials/rootless_tutorial.md
**SELinux and Containers**: https://developers.redhat.com/articles/2025/04/11/my-advice-selinux-container-labeling
