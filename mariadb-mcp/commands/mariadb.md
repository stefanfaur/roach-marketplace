---
name: mariadb
description: Run a guided MariaDB database assessment — schema, indexes, configuration, security
model: opus
---
# MariaDB Database Assessment

Run a systematic health check against a connected MariaDB database using MCP tools.

## Prerequisites

- MariaDB MCP must be connected (check session-start message)
- If MCP is not available, inform the user and suggest `/mariadb-review` for codebase-only analysis

## Process

**Before starting, read these reference files from the mariadb-best-practices skill:**
- `references/schema-design.md`
- `references/indexing.md`
- `references/hidden-gotchas.md`
- `references/security-hardening.md`
- `references/performance-tuning.md`

### Phase 1: Discovery

1. Run `list_databases` to enumerate all databases
2. Ask the user which database(s) to assess (or assess all)
3. Run `list_tables` for each selected database
4. Run `get_table_schema_with_relations` for every table

### Phase 2: Schema Audit

For each table, check:
- **Missing primary keys** — Tables without a PRIMARY KEY
- **Inappropriate data types** — VARCHAR for UUIDs (should be BINARY(16) or CHAR(36)), FLOAT for currency (should be DECIMAL), TEXT where VARCHAR suffices
- **Inconsistent collations** — Run `SELECT TABLE_NAME, COLUMN_NAME, COLLATION_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = '<db>'` and flag tables where JOINable columns (foreign keys, commonly compared columns) have different collations
- **Character set mismatches** — Mixed utf8/utf8mb4 within a database
- **Missing foreign keys** — Columns named `*_id` that reference other tables but lack FK constraints
- **Oversized columns** — VARCHAR(4000) where data is always short

### Phase 3: Index Analysis

For each table, check:
- **Duplicate indexes** — Indexes that are a leftmost prefix of another index on the same table
- **Redundant indexes** — Multiple single-column indexes that could be one composite
- **Missing FK indexes** — Foreign key columns without indexes (MariaDB auto-creates these, but verify)
- **Collation-broken indexes** — Run test EXPLAIN on JOINs between related tables to verify indexes are actually used. If EXPLAIN shows `type: ALL` on a JOIN with indexed columns, the collation likely mismatches
- **Implicit conversion traps** — Check column types on both sides of JOIN ON clauses. INT joined to VARCHAR = full scan
- **Index key length** — For COMPACT row format, verify no index exceeds 767 bytes

Run: `SHOW INDEX FROM <table>` and cross-reference with query patterns.

### Phase 4: Configuration Review

Run these via `execute_sql`:
```sql
SHOW VARIABLES LIKE 'innodb_buffer_pool_size';
SHOW VARIABLES LIKE 'innodb_buffer_pool_instances';
SHOW VARIABLES LIKE 'innodb_flush_log_at_trx_commit';
SHOW VARIABLES LIKE 'innodb_log_file_size';
SHOW VARIABLES LIKE 'thread_handling';
SHOW VARIABLES LIKE 'thread_pool_size';
SHOW VARIABLES LIKE 'slow_query_log';
SHOW VARIABLES LIKE 'long_query_time';
SHOW VARIABLES LIKE 'character_set_server';
SHOW VARIABLES LIKE 'collation_server';
SHOW GLOBAL STATUS LIKE 'Innodb_buffer_pool_read%';
SHOW GLOBAL STATUS LIKE 'Threads_%';
SHOW GLOBAL STATUS LIKE 'Slow_queries';
```

Assess:
- Buffer pool hit ratio: `read_requests / (read_requests + reads)` should be > 99%
- Thread pool enabled or not
- Slow query log active or not
- Server default charset/collation is utf8mb4

### Phase 5: Security Scan

Run via `execute_sql`:
```sql
SELECT User, Host, plugin FROM mysql.user;
SELECT User, Host FROM mysql.user WHERE authentication_string = '' OR authentication_string IS NULL;
SELECT User, Host FROM mysql.user WHERE Host = '%';
SHOW VARIABLES LIKE 'require_secure_transport';
SHOW VARIABLES LIKE 'server_audit%';
```

Flag:
- Users with `GRANT ALL` privileges
- Accounts without passwords
- Root accessible from any host (`%`)
- SSL not enforced
- Audit plugin not enabled

### Phase 6: Report

Present a prioritized report with sections:

1. **Critical** — Issues that will cause data loss, security breaches, or severe performance problems (e.g., collation mismatches on JOIN columns, missing PKs, passwordless accounts)
2. **Warning** — Issues that degrade performance or maintainability (e.g., duplicate indexes, buffer pool undersized, slow query log disabled)
3. **Info** — Suggestions for improvement (e.g., consider partitioning large tables, add missing FKs for referential integrity)

Each finding includes:
- What the issue is
- Which table/column/config is affected
- Specific SQL to fix it
- Link to the relevant reference file for deeper reading
