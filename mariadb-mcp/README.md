# mariadb-mcp

A Claude Code plugin that integrates the [MariaDB MCP server](https://github.com/MariaDB/mcp) with comprehensive best practices for schema design, indexing, query optimization, Hibernate/QueryDSL, performance tuning, security hardening, backup/replication, and migrations.

## Prerequisites

- **MariaDB MCP Server**: Python 3.11+, [uv](https://docs.astral.sh/uv/), and a running MariaDB instance
- **Claude Code**: With plugin support enabled

## Quick Start

### 1. Install and Configure

Run the setup command to automatically install and configure the MariaDB MCP server:

```
/mariadb-setup
```

The setup command will:
- Check prerequisites (Python 3.11+, uv, git)
- Clone the MariaDB MCP server to `~/.claude/mcp-servers/mariadb/`
- Install Python dependencies
- Prompt for your MariaDB connection details
- Generate configuration files
- Update `~/.claude.json` with MCP server settings
- Test the database connection

After setup completes, restart Claude Code to activate the MCP server.

### 2. Update or Reconfigure

Run `/mariadb-setup` again to:
- (U) Update to the latest version from GitHub
- (R) Reconfigure connection details
- (B) Both update and reconfigure
- (Re) Reinstall from scratch

## Manual Setup (Alternative)

If you prefer manual installation:

1. Clone the official MariaDB MCP server:

   ```bash
   git clone https://github.com/MariaDB/mcp.git mariadb-mcp-server
   cd mariadb-mcp-server
   ```

2. Install dependencies:

   ```bash
   uv sync
   ```

3. Configure environment (`.env` or environment variables):

   ```
   MARIADB_HOST=localhost
   MARIADB_PORT=3306
   MARIADB_USER=your_user
   MARIADB_PASSWORD=your_password
   ```

4. Add MCP configuration to `~/.claude.json`:

   **stdio transport:**
   ```json
   {
     "mcpServers": {
       "mariadb": {
         "command": "uv",
         "args": ["--directory", "/path/to/mariadb-mcp-server", "run", "src/main.py"]
       }
     }
   }
   ```

   **SSE transport:**
   ```json
   {
     "mcpServers": {
       "mariadb": {
         "url": "http://localhost:8000/sse"
       }
     }
   }
   ```

   **Docker:**
   ```json
   {
     "mcpServers": {
       "mariadb": {
         "command": "docker",
         "args": ["run", "--rm", "-e", "MARIADB_HOST=host.docker.internal", "mariadb-mcp"]
       }
     }
   }
   ```

## What's Included

### Skill: `mariadb-best-practices`

A router skill that activates when working with MariaDB databases. It reads the relevant reference file(s) based on your task context and provides guided recommendations. If MariaDB MCP is connected, it validates advice against your actual database state.

**Triggers:** "mariadb", "database schema", "hibernate mapping", "querydsl", "slow query", "index not used", "collation", "mariadb performance", "database migration", "replication", "backup database"

### Commands

| Command | Description |
|---------|-------------|
| `/mariadb-setup` | Install and configure the MariaDB MCP server |
| `/mariadb` | Run a guided database health assessment — schema audit, index analysis, configuration review, security scan |
| `/mariadb-review` | Review Java codebase for MariaDB, Hibernate, and QueryDSL issues (no database connection required) |

### Reference Files

All under `skills/mariadb-best-practices/references/`:

| File | Topics |
|------|--------|
| `schema-design.md` | Data types, normalization, partitioning, character sets, collations, engine selection |
| `indexing.md` | B-tree internals, composite indexes, covering indexes, EXPLAIN, ICP, MRR |
| `hidden-gotchas.md` | Collation mismatches, implicit conversions, utf8 vs utf8mb4, row format limits, temporal precision |
| `query-optimization.md` | EXPLAIN/ANALYZE, anti-patterns, JOIN ordering, subquery strategies, optimizer_switch, histograms |
| `hibernate-querydsl.md` | Dialect selection, entity mapping, fetch strategies, N+1, caching, batching, QueryDSL patterns |
| `performance-tuning.md` | Buffer pool, thread pool, slow query log, monitoring metrics, connection pooling |
| `security-hardening.md` | Least privilege, password validation, SSL/TLS, audit plugin, encryption at rest |
| `backup-replication.md` | Mariabackup, mariadb-dump, PITR, GTID replication, Galera Cluster, MaxScale |
| `migrations.md` | Flyway/Liquibase, zero-downtime DDL, pt-osc/gh-ost, instant ADD COLUMN, rollback strategies |

### Session-Start Hook

Automatically detects MariaDB MCP server configuration in `~/.claude.json` at session start and reports:
- Whether the MCP server is configured
- For SSE/HTTP: whether the server port is reachable
- For stdio: that the server is configured and should be available

## License

MIT
