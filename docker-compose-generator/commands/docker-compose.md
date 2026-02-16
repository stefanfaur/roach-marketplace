---
name: docker-compose
description: Generate Docker Compose or Podman Compose configurations
---
# Docker/Podman Compose Generator

Generate production-ready compose files with best practices for Docker or Podman.

## Configuration Patterns

1. **Multi-Service Architecture**: Define all services with dependencies
2. **Environment Variables**: Use .env files for configuration
3. **Volume Management**: Persistent data and named volumes
4. **Network Configuration**: Custom networks for service isolation
5. **Health Checks**: Service health monitoring
6. **Resource Limits**: CPU and memory constraints

## Runtime Selection

Before generating, determine the target runtime:

- **Docker Compose** (`docker compose`) — Docker daemon, bridge networking, service-name DNS
- **Podman Compose** (`podman compose` or `podman-compose`) — Daemonless, rootless by default, pod-based networking (see Podman-specific notes below)

## Docker Compose Example (Full Stack)

```yaml
services:
  frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - REACT_APP_API_URL=http://api:4000
    depends_on:
      - api
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000"]
      interval: 30s
      timeout: 10s
      retries: 3
    networks:
      - app-network

  api:
    build:
      context: ./api
      dockerfile: Dockerfile
    ports:
      - "4000:4000"
    environment:
      - NODE_ENV=production
      - DATABASE_URL=postgresql://user:pass@postgres:5432/db
      - REDIS_URL=redis://redis:6379
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_started
    volumes:
      - ./api/logs:/app/logs
    deploy:
      resources:
        limits:
          cpus: '1'
          memory: 512M
    networks:
      - app-network
      - db-network

  postgres:
    image: postgres:15-alpine
    environment:
      - POSTGRES_DB=myapp
      - POSTGRES_USER=user
      - POSTGRES_PASSWORD=pass
    volumes:
      - postgres-data:/var/lib/postgresql/data
      - ./init.sql:/docker-entrypoint-initdb.d/init.sql
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U user"]
      interval: 10s
      timeout: 5s
      retries: 5
    networks:
      - db-network

  redis:
    image: redis:7-alpine
    command: redis-server --appendonly yes
    volumes:
      - redis-data:/data
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 5s
      retries: 3
    networks:
      - app-network

  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf:ro
      - ./ssl:/etc/nginx/ssl:ro
    depends_on:
      - frontend
      - api
    networks:
      - app-network

volumes:
  postgres-data:
  redis-data:

networks:
  app-network:
    driver: bridge
  db-network:
    driver: bridge
```

## Podman Compose Example (Full Stack)

Key adaptations for Podman's rootless, pod-based architecture:

```yaml
# No 'version' key needed — Podman supports Compose Specification directly
services:
  frontend:
    build:
      context: ./frontend
      # Podman natively uses 'Containerfile' but accepts 'Dockerfile'
      dockerfile: Dockerfile
    ports:
      # Rootless Podman: cannot bind ports < 1024 by default
      # Use ports >= 1024 or set net.ipv4.ip_unprivileged_port_start=80
      - "3000:3000"
    environment:
      - NODE_ENV=production
      # Pod-based networking: containers in the same pod share localhost
      # For services in the same compose project, service-name DNS works
      # IF using a custom bridge network (not the default 'podman' network)
      - REACT_APP_API_URL=http://api:4000
    depends_on:
      - api
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000"]
      interval: 30s
      timeout: 10s
      retries: 3
    networks:
      - app-network

  api:
    build:
      context: ./api
      dockerfile: Dockerfile
    ports:
      - "4000:4000"
    environment:
      - NODE_ENV=production
      - DATABASE_URL=postgresql://user:pass@postgres:5432/db
      - REDIS_URL=redis://redis:6379
    depends_on:
      postgres:
        # Requires podman-compose with Podman 4.6.0+ for health check conditions
        condition: service_healthy
      redis:
        condition: service_started
    volumes:
      # SELinux systems (RHEL/Fedora/CentOS): add :z for shared or :Z for private
      - ./api/logs:/app/logs:z
    # NOTE: 'deploy.resources' works with docker-compose backend via `podman compose`
    # but may be ignored by podman-compose (the Python tool)
    # Alternative: use --cpus and --memory flags or set in containers.conf
    networks:
      - app-network
      - db-network

  postgres:
    image: postgres:15-alpine
    environment:
      - POSTGRES_DB=myapp
      - POSTGRES_USER=user
      - POSTGRES_PASSWORD=pass
    volumes:
      - postgres-data:/var/lib/postgresql/data
      # SELinux: :z for bind mounts on RHEL-based systems
      - ./init.sql:/docker-entrypoint-initdb.d/init.sql:z
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U user"]
      interval: 10s
      timeout: 5s
      retries: 5
    networks:
      - db-network

  redis:
    image: redis:7-alpine
    command: redis-server --appendonly yes
    volumes:
      - redis-data:/data
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 5s
      retries: 3
    networks:
      - app-network

  nginx:
    image: nginx:alpine
    ports:
      # Rootless: ports 80/443 require sysctl adjustment or use 8080/8443
      - "8080:80"
      - "8443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf:ro,z
      - ./ssl:/etc/nginx/ssl:ro,z
    depends_on:
      - frontend
      - api
    networks:
      - app-network

volumes:
  postgres-data:
  redis-data:

networks:
  # Custom bridge networks enable DNS resolution between containers
  # The default 'podman' network does NOT support DNS (backwards compat)
  app-network:
    driver: bridge
  db-network:
    driver: bridge
```

## Podman Compose vs Docker Compose — Key Differences

When generating compose files for Podman, apply these rules:

| Feature | Docker Compose | Podman Compose |
|---------|---------------|----------------|
| Daemon | Requires Docker daemon | Daemonless — runs containers directly |
| Default user | Root | **Rootless** by default |
| Ports < 1024 | Allowed (root) | **Blocked rootless** — use >= 1024 or set `net.ipv4.ip_unprivileged_port_start` |
| Networking | Bridge network per project, service-name DNS | **Pod-based** — containers share network namespace. Custom bridge networks required for DNS |
| Service-name DNS | Always works | Only on **custom bridge networks**, NOT on default `podman` network |
| `deploy.resources` | Supported | Supported via `podman compose` (docker-compose backend); **may be ignored** by `podman-compose` (Python tool) |
| `deploy.replicas` | Swarm mode | **Not supported** — no Swarm equivalent |
| SELinux volumes | Not needed | Add **`:z`** (shared) or **`:Z`** (private) on RHEL/Fedora/CentOS |
| Volume permissions (rootless) | Normal | UID/GID mapping via user namespaces — use **`:U`** suffix to auto-chown |
| `depends_on` + healthcheck | Supported | Requires **Podman 4.6.0+** and recent podman-compose |
| `network_mode: host` | Works | Known issues with multiple networks |
| `Containerfile` | Uses `Dockerfile` | Natively uses **`Containerfile`**, accepts `Dockerfile` |
| Service profiles | Supported | Supported since podman-compose v1.1.0 |
| Secrets | Docker secrets | Mounted at `/run/secrets/` — same pattern |
| `env_file` (multiple) | Multiple supported | podman-compose: **only single `--env-file`** at a time |
| SystemD integration | Not native | **`podman generate systemd`** or Quadlet units |
| Kubernetes export | Not native | **`podman generate kube`** / **`podman play kube`** |

### `podman compose` vs `podman-compose`

Two different tools:

- **`podman compose`** (built-in wrapper): Delegates to docker-compose or podman-compose. Sets up Podman socket. More feature-complete when using docker-compose backend.
- **`podman-compose`** (Python package): Translates compose spec to Podman CLI commands directly. Lighter weight, more Podman-native, but implements a **subset** of features.

**Recommendation**: Use `podman compose` with docker-compose backend for maximum compatibility. Use `podman-compose` for lightweight, Podman-native deployments.

### Podman Compose Checklist

When generating for Podman:

1. Drop `version:` key (use Compose Specification format)
2. Map privileged ports (80, 443) to >= 1024 for rootless, or document sysctl requirement
3. Add `:z` or `:Z` SELinux suffixes on bind mount volumes for RHEL-based systems
4. Use `:U` volume suffix where rootless UID mapping causes permission issues
5. Always define custom bridge networks — do NOT rely on the default `podman` network for DNS
6. Remove `deploy.replicas` and Swarm-specific configuration
7. Test `depends_on` with `condition: service_healthy` only if Podman >= 4.6.0
8. Use single `env_file` per service with podman-compose, or switch to `podman compose`
9. For production: generate systemd units with `podman generate systemd` or Quadlet

## Best Practices (Both Runtimes)

- Service dependencies with health checks
- Named volumes for data persistence
- Custom networks for isolation
- Resource limits for stability
- Environment variable management via `.env` files
- Multi-stage builds for smaller images
- Health check configurations for all services
- Logging configuration

## When Invoked

1. Ask the user whether they use Docker Compose or Podman Compose
2. If Podman: ask if rootless (default) and which OS (for SELinux guidance)
3. Generate complete compose configurations with appropriate adaptations
4. Include inline comments explaining runtime-specific decisions
