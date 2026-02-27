# MariaDB MCP Plugin Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use executing-plans to implement this plan task-by-task.

**Goal:** Create a marketplace plugin that integrates the MariaDB MCP server with a comprehensive best practices skill for schema design, indexing, query optimization, Hibernate/QueryDSL, and database operations.

**Architecture:** Plugin follows the existing marketplace pattern (`.claude-plugin/plugin.json`, `skills/`, `commands/`, `hooks/`). The skill uses a router pattern — SKILL.md directs agents to read specific reference files based on task context. All reference content is researched from official primary sources only (MariaDB KB, Hibernate docs, QueryDSL docs).

**Tech Stack:** Node.js (hooks), Markdown (skills/commands/references), MariaDB MCP server (Python/uv)

---

### Task 1: Create Plugin Scaffold

**Files:**
- Create: `mariadb-mcp/.claude-plugin/plugin.json`
- Create: `mariadb-mcp/LICENSE`

**Step 1: Create plugin.json**

Create `mariadb-mcp/.claude-plugin/plugin.json`:

```json
{
  "name": "mariadb-mcp",
  "version": "1.0.0",
  "description": "MariaDB MCP server integration with comprehensive best practices for schema design, indexing, query optimization, Hibernate/QueryDSL, and operations",
  "author": {
    "name": "Stefan Faur"
  },
  "repository": "https://github.com/MariaDB/mcp",
  "license": "MIT",
  "keywords": [
    "mariadb",
    "mysql",
    "database",
    "mcp",
    "hibernate",
    "querydsl",
    "sql",
    "indexing",
    "schema-design"
  ]
}
```

**Step 2: Create LICENSE**

Create `mariadb-mcp/LICENSE` with MIT license text, copyright 2026 Stefan Faur.

**Step 3: Create empty directory structure**

Create these empty directories (files will be populated in subsequent tasks):
- `mariadb-mcp/skills/mariadb-best-practices/references/`
- `mariadb-mcp/commands/`
- `mariadb-mcp/hooks/`

---

### Task 2: Research and Write Reference Files (Parallel)

All 9 reference files must be built by `web-search-researcher` subagents fetching from primary sources only. **Launch all 9 in parallel.** Each subagent must:

1. Search official sources ONLY:
   - `mariadb.com/kb/` — Official MariaDB Knowledge Base
   - `dev.mysql.com/doc/` — MySQL docs (where MariaDB inherits InnoDB behavior)
   - `docs.jboss.org/hibernate/` — Official Hibernate ORM docs
   - `querydsl.com/static/querydsl/` — Official QueryDSL reference
   - `github.com/MariaDB/` — Official repos
   - `mariadb.com/resources/blog/` — Official MariaDB team blog
2. Include inline source URLs as citations for every recommendation
3. No Stack Overflow, no random blog posts

**Files to create** (all under `mariadb-mcp/skills/mariadb-best-practices/references/`):

#### 2a: schema-design.md

**Research prompt for subagent:**
"Research MariaDB schema design best practices from official MariaDB documentation (mariadb.com/kb/) and dev.mysql.com/doc/. Cover: choosing correct data types (INT sizes, VARCHAR vs TEXT, DECIMAL vs FLOAT, temporal types with precision, UUID storage strategies), normalization levels and when to denormalize, partitioning strategies (RANGE, LIST, HASH — when each is appropriate), character set and collation selection at server/database/table/column level (utf8mb3 vs utf8mb4 implications), table engine selection (InnoDB vs Aria vs MEMORY). Include source URLs for every recommendation. Write as a markdown reference document."

Write result to: `mariadb-mcp/skills/mariadb-best-practices/references/schema-design.md`

#### 2b: indexing.md

**Research prompt for subagent:**
"Research MariaDB indexing best practices from official MariaDB documentation (mariadb.com/kb/) and dev.mysql.com/doc/. Cover: B-tree index internals and how they serve range queries, composite index column ordering (leftmost prefix rule), covering indexes (index-only scans), prefix indexes and their limitations, fulltext indexes, spatial indexes, unique vs non-unique, duplicate and redundant index detection, index size limits by InnoDB row format (COMPACT vs DYNAMIC vs COMPRESSED), how to read EXPLAIN output for index usage, index condition pushdown (ICP), multi-range read (MRR). Include source URLs for every recommendation. Write as a markdown reference document."

Write result to: `mariadb-mcp/skills/mariadb-best-practices/references/indexing.md`

#### 2c: hidden-gotchas.md

**Research prompt for subagent:**
"Research hidden MariaDB gotchas and pitfalls from official MariaDB documentation (mariadb.com/kb/) and dev.mysql.com/doc/. This is the MOST CRITICAL reference file. Cover: collation mismatches between columns making indexes unusable on JOINs (e.g., utf8mb4_general_ci vs utf8mb4_unicode_ci on joined columns), implicit type conversions in WHERE clauses bypassing indexes (e.g., comparing VARCHAR to INT), utf8 vs utf8mb4 — utf8 is actually utf8mb3 and truncates 4-byte characters, InnoDB row format impacts on maximum index key length (767 bytes for COMPACT, 3072 for DYNAMIC), temporal type precision loss (DATETIME vs TIMESTAMP, fractional seconds), ORDER BY with LIMIT optimizer traps (filesort on non-indexed columns), subquery materialization vs semi-join differences from MySQL, silent data truncation on INSERT with strict mode off, character set coercion rules in expressions, GROUP BY implicit sorting (removed in MySQL 8 but still present in MariaDB), ONLY_FULL_GROUP_BY differences, NULL handling in indexes and unique constraints, large transaction rollback performance, AUTO_INCREMENT gaps after rollback. Include source URLs for every claim. Write as a markdown reference document."

Write result to: `mariadb-mcp/skills/mariadb-best-practices/references/hidden-gotchas.md`

#### 2d: query-optimization.md

**Research prompt for subagent:**
"Research MariaDB query optimization from official MariaDB documentation (mariadb.com/kb/) and dev.mysql.com/doc/. Cover: reading EXPLAIN and EXPLAIN ANALYZE output (all columns explained), common query anti-patterns (SELECT *, implicit conversions, functions on indexed columns, OR vs UNION, correlated subqueries), JOIN ordering and optimizer hints, subquery vs JOIN performance characteristics, derived table materialization, index condition pushdown (ICP), multi-range read (MRR), batched key access (BKA), hash join support, optimizer_switch settings, query cache (deprecated in MySQL 8 but present in MariaDB), ANALYZE TABLE for statistics, histogram statistics. Include source URLs for every recommendation. Write as a markdown reference document."

Write result to: `mariadb-mcp/skills/mariadb-best-practices/references/query-optimization.md`

#### 2e: hibernate-querydsl.md

**Research prompt for subagent:**
"Research Hibernate ORM and QueryDSL best practices specifically for MariaDB from official docs (docs.jboss.org/hibernate/, querydsl.com/static/querydsl/, mariadb.com/kb/). Cover: correct Hibernate dialect for MariaDB (org.hibernate.dialect.MariaDBDialect vs MariaDB103Dialect etc.), entity mapping best practices (@Column type mappings matching MariaDB types — String length defaults to VARCHAR(255), BigDecimal precision, temporal types with @Temporal vs java.time), fetch strategy selection (LAZY vs EAGER, @BatchSize, @Fetch(FetchMode.SUBSELECT)), N+1 detection and prevention patterns, @EntityGraph usage, second-level cache configuration (Ehcache/Caffeine with MariaDB), batch insert/update tuning (hibernate.jdbc.batch_size, hibernate.order_inserts), connection pooling (HikariCP configuration for MariaDB — validation query, leak detection), QueryDSL patterns (JPAQueryFactory setup, proper .fetchJoin() usage to avoid N+1, pagination with .offset()/.limit() and .fetchCount(), avoiding Cartesian products from multiple joins, BooleanBuilder for dynamic queries, Projections.constructor for DTOs instead of fetching full entities), identifier generation strategies (@GeneratedValue with IDENTITY vs SEQUENCE for MariaDB). Include source URLs for every recommendation. Write as a markdown reference document."

Write result to: `mariadb-mcp/skills/mariadb-best-practices/references/hibernate-querydsl.md`

#### 2f: performance-tuning.md

**Research prompt for subagent:**
"Research MariaDB performance tuning from official MariaDB documentation (mariadb.com/kb/) and dev.mysql.com/doc/. Cover: InnoDB buffer pool sizing (rule of thumb: 70-80% of available RAM for dedicated servers), innodb_buffer_pool_instances, thread pool configuration (thread_handling, thread_pool_size), slow query log setup (long_query_time, log_slow_rate_limit), SHOW GLOBAL STATUS key metrics (Innodb_buffer_pool_read_requests vs Innodb_buffer_pool_reads for hit ratio, Threads_running, Threads_connected, Slow_queries), connection pool sizing on application side (HikariCP defaults), performance_schema setup and key tables, SHOW PROCESSLIST analysis, INFORMATION_SCHEMA.INNODB_TRX for long transactions, ANALYZE TABLE for optimizer statistics, innodb_flush_log_at_trx_commit trade-offs, innodb_log_file_size, tmp_table_size and max_heap_table_size, join_buffer_size, sort_buffer_size. Include source URLs for every recommendation. Write as a markdown reference document."

Write result to: `mariadb-mcp/skills/mariadb-best-practices/references/performance-tuning.md`

#### 2g: security-hardening.md

**Research prompt for subagent:**
"Research MariaDB security hardening from official MariaDB documentation (mariadb.com/kb/). Cover: principle of least privilege (GRANT specific privileges, never GRANT ALL on production), mariadb-secure-installation, password validation plugin, SSL/TLS enforcement (require_secure_transport), audit plugin (server_audit), SQL injection prevention (parameterized queries — how Hibernate/QueryDSL handle this), network binding (bind-address, skip-networking for local-only), mysql.user table cleanup (removing anonymous users, root remote access), database-level user separation, password expiry, connection limits per user, data-at-rest encryption (InnoDB tablespace encryption). Include source URLs for every recommendation. Write as a markdown reference document."

Write result to: `mariadb-mcp/skills/mariadb-best-practices/references/security-hardening.md`

#### 2h: backup-replication.md

**Research prompt for subagent:**
"Research MariaDB backup and replication from official MariaDB documentation (mariadb.com/kb/). Cover: mariadb-backup (Mariabackup) for hot physical backups (full and incremental), mariadb-dump (mysqldump) for logical backups and when to use each, point-in-time recovery with binary logs (mysqlbinlog), GTID-based replication setup and benefits, semi-synchronous replication configuration, MariaDB MaxScale proxy for read/write splitting, Galera Cluster basics (synchronous multi-master), failover patterns (automatic vs manual), backup verification strategies (restore testing), binary log retention and purging, replication filters (replicate-do-db, replicate-ignore-db). Include source URLs for every recommendation. Write as a markdown reference document."

Write result to: `mariadb-mcp/skills/mariadb-best-practices/references/backup-replication.md`

#### 2i: migrations.md

**Research prompt for subagent:**
"Research MariaDB schema migration best practices from official MariaDB documentation (mariadb.com/kb/), Flyway docs (documentation.red-gate.com/flyway/), and Liquibase docs (docs.liquibase.com/). Cover: Flyway configuration for MariaDB (driver, URL format, baseline), Liquibase MariaDB support and changesets, zero-downtime DDL strategies (ALTER TABLE with ALGORITHM=INPLACE vs ALGORITHM=COPY — which operations support INPLACE), pt-online-schema-change and gh-ost for large table alterations, always specifying explicit CHARACTER SET and COLLATE in migration DDL, foreign key index requirements (MariaDB auto-creates indexes for FKs), adding columns with defaults (instant ADD COLUMN in newer MariaDB), dropping columns safely, renaming tables vs creating new + migrating, rollback strategies (forward-only migrations vs reversible), migration ordering and dependency management, testing migrations against production-size datasets. Include source URLs for every recommendation. Write as a markdown reference document."

Write result to: `mariadb-mcp/skills/mariadb-best-practices/references/migrations.md`

---

### Task 3: Write SKILL.md

**Files:**
- Create: `mariadb-mcp/skills/mariadb-best-practices/SKILL.md`

**Step 1: Write the skill file**

This depends on Task 2 completing (need to know what's in the references to route correctly). The skill acts as a router — it does NOT contain best practices content itself.

Create `mariadb-mcp/skills/mariadb-best-practices/SKILL.md`:

```markdown
---
name: mariadb-best-practices
description: |
  Use when you need to work with MariaDB databases, write or review SQL,
  design schemas, optimize queries, configure Hibernate/QueryDSL for MariaDB,
  or troubleshoot database performance issues.
  Trigger with phrases like "mariadb", "database schema", "hibernate mapping",
  "querydsl", "slow query", "index not used", "collation", "mariadb performance",
  "database migration", "replication", "backup database".
allowed-tools: Read, Write, Edit, Grep, Glob, Bash(mysql:*), Bash(mariadb:*)
version: 1.0.0
author: Stefan Faur
license: MIT
---
# MariaDB Best Practices

Comprehensive MariaDB guidance for schema design, indexing, query optimization,
Hibernate/QueryDSL integration, performance tuning, security, backup/replication,
and migrations.

## How This Skill Works

This skill is a **router**. It identifies what you need and directs you to the
right reference document. All reference files are in `references/` relative to
this skill file.

**If MariaDB MCP tools are available in this session**, always use them to
validate recommendations against the actual database state. Don't give
theoretical advice when you can check `SHOW CREATE TABLE`, `SHOW COLLATION`,
`EXPLAIN`, `SHOW GLOBAL STATUS`, etc.

## Task Routing

Based on what the user needs, read the relevant reference file(s):

### Schema Design
- User is designing tables, choosing data types, setting up character sets/collations
- **Read:** `references/schema-design.md`
- **Also read:** `references/hidden-gotchas.md` (collation and charset traps)

### Indexing
- User is adding indexes, diagnosing unused indexes, or index-related EXPLAIN issues
- **Read:** `references/indexing.md`
- **Also read:** `references/hidden-gotchas.md` (collation mismatches, implicit conversions)
- **Critical check:** Before suggesting any index, verify collation compatibility
  across all columns involved in JOINs and WHERE clauses

### Query Optimization
- User has slow queries, needs EXPLAIN analysis, or wants query rewrites
- **Read:** `references/query-optimization.md`
- **Also read:** `references/hidden-gotchas.md` (optimizer traps)
- **If MCP available:** Run EXPLAIN ANALYZE on the actual query

### Hibernate / QueryDSL
- User is mapping entities, writing QueryDSL queries, fixing N+1, or configuring Hibernate
- **Read:** `references/hibernate-querydsl.md`
- **Also read:** `references/hidden-gotchas.md` (type mapping pitfalls)
- **Scan codebase for:** `@Entity`, `@Column`, `JPAQueryFactory`, `QClass` files

### Performance Tuning
- User is tuning MariaDB server config, diagnosing slow performance, or monitoring
- **Read:** `references/performance-tuning.md`
- **If MCP available:** Check `SHOW GLOBAL STATUS`, `SHOW VARIABLES`, buffer pool hit ratio

### Security
- User is hardening MariaDB, managing users/privileges, or setting up SSL
- **Read:** `references/security-hardening.md`

### Backup & Replication
- User is setting up backups, replication, failover, or recovery
- **Read:** `references/backup-replication.md`

### Migrations
- User is writing migration scripts, doing schema changes, or planning zero-downtime DDL
- **Read:** `references/migrations.md`
- **Also read:** `references/hidden-gotchas.md` (collation in DDL, ALTER TABLE locking)

## Cross-Cutting Rules

These apply regardless of task type:

1. **Always check collations.** When any query involves JOINs or comparisons across
   tables, verify that the joined/compared columns have matching collations. Mismatched
   collations silently disable index usage.

2. **Always check for implicit type conversions.** A WHERE clause comparing a VARCHAR
   column to an INT literal will cause a full table scan. Check EXPLAIN.

3. **Prefer utf8mb4 over utf8.** MariaDB's `utf8` is actually `utf8mb3` and cannot
   store 4-byte Unicode characters (emoji, some CJK). Always use `utf8mb4`.

4. **Validate against actual state.** If MariaDB MCP is connected, always verify
   recommendations by querying the actual database before presenting them. Run
   `SHOW CREATE TABLE`, check `INFORMATION_SCHEMA`, use `EXPLAIN`.

5. **Hibernate dialect matters.** Ensure the project uses `org.hibernate.dialect.MariaDBDialect`
   (or version-specific variant), not a MySQL dialect. Wrong dialect = wrong DDL generation.

## MariaDB MCP Tools Reference

When MariaDB MCP is available, these tools are at your disposal:
- `list_databases` — Enumerate all databases
- `list_tables` — List tables in a database
- `get_table_schema` — Column definitions, types, keys
- `get_table_schema_with_relations` — Schema + foreign key relationships
- `execute_sql` — Run SELECT, SHOW, DESCRIBE, EXPLAIN queries (read-only by default)
- `create_database` — Create new databases

Use these to validate any recommendation before presenting it.
```

---

### Task 4: Write `/mariadb` Command

**Files:**
- Create: `mariadb-mcp/commands/mariadb.md`

**Step 1: Write the command file**

Create `mariadb-mcp/commands/mariadb.md`:

```markdown
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
```

---

### Task 5: Write `/mariadb-review` Command

**Files:**
- Create: `mariadb-mcp/commands/mariadb-review.md`

**Step 1: Write the command file**

Create `mariadb-mcp/commands/mariadb-review.md`:

```markdown
---
name: mariadb-review
description: Review Java codebase for MariaDB, Hibernate, and QueryDSL issues
model: opus
---
# MariaDB Codebase Review

Scan a Java project's source code for MariaDB-related issues in Hibernate entities,
QueryDSL queries, and migration files. No database connection required.

## Prerequisites

- Java project with Hibernate and/or QueryDSL
- If MariaDB MCP is also available, enables cross-reference against live schema

## Process

**Before starting, read these reference files from the mariadb-best-practices skill:**
- `references/hibernate-querydsl.md`
- `references/hidden-gotchas.md`
- `references/migrations.md`
- `references/indexing.md`

### Phase 1: Entity Scan

Search for all `@Entity` annotated classes:

```
Grep for: @Entity
Glob for: **/*Entity.java, **/model/**/*.java, **/entity/**/*.java, **/domain/**/*.java
```

For each entity, check:

**Type Mapping Issues:**
- `String` fields without explicit `@Column(length=...)` — defaults to VARCHAR(255), may truncate
- `BigDecimal` without `@Column(precision=..., scale=...)` — MariaDB needs explicit precision
- `java.util.Date` or `java.sql.Timestamp` — should use `java.time.LocalDateTime` / `Instant`
- `@Lob` on String — creates LONGTEXT, verify this is intentional vs TEXT
- `byte[]` fields — check if mapped to BLOB vs VARBINARY
- UUID fields — check storage strategy (VARCHAR(36) vs BINARY(16))

**Fetch Strategy Issues:**
- `@OneToMany` or `@ManyToMany` without explicit `fetch = FetchType.LAZY` — JPA default for collections is LAZY but verify
- `@ManyToOne` or `@OneToOne` without explicit `fetch = FetchType.LAZY` — JPA default is EAGER, this is almost always wrong
- `@ManyToOne(fetch = EAGER)` — explicit eager fetching, flag as warning
- Collection mappings without `@BatchSize` — will cause N+1 when iterating
- Missing `@Fetch(FetchMode.SUBSELECT)` on frequently accessed collections

**Index Issues:**
- `@JoinColumn` without a corresponding `@Index` — foreign key columns need indexes
- Missing `@Table(indexes = ...)` for commonly queried columns
- `@Column(unique = true)` — verify this is intentional and not redundant with a separate index

**Cascade Issues:**
- `CascadeType.ALL` or `CascadeType.REMOVE` on `@ManyToOne` — dangerous, can delete parent
- `orphanRemoval = true` without `CascadeType.PERSIST` — inconsistent lifecycle

**Identifier Issues:**
- `@GeneratedValue(strategy = GenerationType.AUTO)` — may use TABLE strategy on some configs, prefer IDENTITY for MariaDB
- `@GeneratedValue(strategy = GenerationType.SEQUENCE)` — MariaDB sequences work but IDENTITY is more common

### Phase 2: QueryDSL Scan

Search for QueryDSL usage:

```
Grep for: JPAQueryFactory, JPAQuery, BooleanBuilder, Q[A-Z]
Glob for: **/Q*.java (generated Q-classes), **/*Repository*.java, **/*Service*.java
```

For each QueryDSL usage, check:

**Unbounded Queries:**
- `.fetch()` without `.limit()` — could return millions of rows
- `.fetchResults()` (deprecated) — use `.fetch()` + separate `.fetchCount()`

**N+1 Patterns:**
- Traversing associations in results without `.fetchJoin()` on the query
- `.leftJoin(entity.association)` without `.fetchJoin()` when the association is accessed later
- Iterating over query results and accessing lazy collections in a loop

**Cartesian Product Risks:**
- Multiple `.leftJoin().fetchJoin()` on collection associations — produces Cartesian product
- More than one collection join in same query — use separate queries or `@BatchSize`

**SQL Injection:**
- String concatenation in `.where()` predicates — must use typed expressions
- `Expressions.stringTemplate()` with unparameterized user input

**Pagination Issues:**
- `.offset()` + `.limit()` without `.orderBy()` — non-deterministic results
- Large offset values — consider keyset pagination instead

### Phase 3: Migration File Scan

Search for migration files:

```
Glob for: **/db/migration/**/*.sql, **/db/changelog/**/*.sql,
          **/db/changelog/**/*.xml, **/db/changelog/**/*.yaml,
          **/flyway/**/*.sql, **/liquibase/**/*.xml
```

For each migration, check:

**Collation Issues:**
- `CREATE TABLE` without explicit `CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
- `ALTER TABLE ADD COLUMN` on VARCHAR/TEXT without explicit collation — inherits table default, which may differ from other tables
- Mixed collation references across migrations

**Locking DDL:**
- `ALTER TABLE ... ADD COLUMN` with a DEFAULT on large tables (MariaDB 10.3.2+ supports instant ADD COLUMN, but older versions copy the whole table)
- `ALTER TABLE ... MODIFY COLUMN` changing column type — always copies table
- `ALTER TABLE ... ADD INDEX` — online by default but verify with `ALGORITHM=INPLACE`
- `DROP INDEX` + `CREATE INDEX` instead of `ALTER TABLE ... RENAME INDEX`

**Missing Indexes:**
- `ADD CONSTRAINT FOREIGN KEY` without a preceding or existing index on the FK column
- New columns frequently used in WHERE clauses without corresponding index

**Data Safety:**
- `ALTER TABLE ... DROP COLUMN` — is the column truly unused? Check for Hibernate entity drift
- `TRUNCATE TABLE` or `DROP TABLE` in non-cleanup migrations
- Type changes that narrow data (e.g., VARCHAR(255) to VARCHAR(100), INT to SMALLINT)

### Phase 4: Cross-Reference (if MCP available)

If MariaDB MCP is connected, compare:

1. **Entity vs Schema drift:**
   - For each `@Entity`, fetch `get_table_schema` for the corresponding table
   - Compare `@Column` definitions to actual column types
   - Flag mismatches: entity says `VARCHAR(255)` but table has `VARCHAR(100)`, entity has field but column doesn't exist, table has column but entity doesn't map it

2. **Index coverage:**
   - Compare `@Index` annotations to actual indexes via `SHOW INDEX FROM`
   - Flag indexes in code not in DB (migration not run?) and indexes in DB not in code (orphaned?)

3. **Collation verification:**
   - For each `@JoinColumn`, verify both sides of the relationship have matching collations in the actual database

### Phase 5: Report

Present a prioritized report:

1. **Critical** — Will cause bugs or data issues (N+1 in hot paths, Cartesian products, missing fetch joins, collation mismatches in entities, SQL injection risks, type mapping that truncates data)
2. **Warning** — Performance or maintainability concerns (eager fetching, missing @BatchSize, unbounded queries, missing indexes on FKs, non-explicit collation in migrations)
3. **Info** — Suggestions (deprecated API usage, identifier strategy, pagination approach)

Each finding includes:
- File path and line number
- What the issue is with code snippet
- Specific fix with corrected code
- Link to the relevant reference file
```

---

### Task 6: Write Session-Start Hook

**Files:**
- Create: `mariadb-mcp/hooks/hooks.json`
- Create: `mariadb-mcp/hooks/session-start.js`

**Step 1: Create hooks.json**

Create `mariadb-mcp/hooks/hooks.json`:

```json
{
  "hooks": {
    "SessionStart": [
      {
        "matcher": "",
        "hooks": [
          {
            "type": "command",
            "command": "node ${CLAUDE_PLUGIN_ROOT}/hooks/session-start.js"
          }
        ]
      }
    ]
  }
}
```

**Step 2: Create session-start.js**

Create `mariadb-mcp/hooks/session-start.js`:

The hook must:
1. Read `~/.claude.json` to check if any MCP server with "mariadb" in the name is configured
2. If found, parse the URL/command and attempt to verify the server is reachable (TCP check on the port for SSE/HTTP, or just report configured for stdio)
3. Output JSON with `hookSpecificOutput.additionalContext` containing the status message

Follow the exact pattern from `roach/hooks/session-start.js` — use `require('fs')`, `require('net')`, `require('path')`, `require('os')`, no ES modules.

Key logic:
```javascript
// Check ~/.claude.json for MCP servers with "mariadb" in the key name
var claudeJson = readJSON(path.join(os.homedir(), '.claude.json'));
// Look through claudeJson.mcpServers for keys containing 'mariadb' (case-insensitive)
// If found with URL (SSE/HTTP): check port reachability
// If found with command (stdio): report as configured
// If not found: report not configured
```

Output format:
```javascript
var output = {
  hookSpecificOutput: {
    hookEventName: 'SessionStart',
    additionalContext: '--- MariaDB MCP ---\n' + statusMessage + '\n---'
  }
};
```

---

### Task 7: Update Marketplace Manifest

**Files:**
- Modify: `.claude-plugin/marketplace.json`

**Step 1: Add mariadb-mcp entry to the plugins array**

Add this entry to the `plugins` array in `.claude-plugin/marketplace.json`:

```json
{
  "name": "mariadb-mcp",
  "description": "MariaDB MCP integration with best practices for schema design, indexing, Hibernate/QueryDSL, and database operations",
  "version": "1.0.0",
  "source": "./mariadb-mcp",
  "category": "development"
}
```

---

### Task 8: Write README.md

**Files:**
- Create: `mariadb-mcp/README.md`

**Step 1: Write README**

Cover:
- What the plugin does (one paragraph)
- Prerequisites (Python 3.11+, uv, MariaDB server)
- MariaDB MCP server setup (clone, install, .env config — from https://github.com/MariaDB/mcp)
- MCP configuration for Claude Code (stdio, SSE, HTTP, Docker options)
- Available skill, commands (`/mariadb`, `/mariadb-review`)
- Reference files list with one-line descriptions
- Session-start hook behavior

---

### Task 9: Commit

```bash
git add mariadb-mcp/ .claude-plugin/marketplace.json
git commit -m "Add mariadb-mcp plugin with best practices skill, commands, and MCP hook"
```

---

## Execution Notes

- **Task 2 is the heavyweight**: 9 parallel web-search-researcher subagents. Each should take 1-3 minutes. Launch all simultaneously.
- **Task 3 depends on Task 2**: SKILL.md references the completed reference files.
- **Tasks 4-6 can run in parallel** after Task 2 completes (they reference the same reference files).
- **Task 7 is independent** and can run anytime.
- **Task 8 depends on all other tasks** (documents everything).
- **Task 9 is last**.

## Dependency Graph

```
Task 1 (scaffold)
  └─> Task 2 (9 reference files in parallel)
        └─> Task 3 (SKILL.md)
        └─> Task 4 (/mariadb command)
        └─> Task 5 (/mariadb-review command)
  └─> Task 6 (hook) — independent of Task 2
  └─> Task 7 (marketplace.json) — independent
        └─> Task 8 (README) — after all above
              └─> Task 9 (commit)
```
