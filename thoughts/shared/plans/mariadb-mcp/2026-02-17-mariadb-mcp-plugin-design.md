# MariaDB MCP Plugin Design

## Overview

A marketplace plugin that bundles the official MariaDB MCP server configuration with a comprehensive best practices skill covering database design, operations, and Java development (Hibernate + QueryDSL). Includes two slash commands for database assessment and codebase review, plus a session-start hook for MCP availability detection.

## Plugin Structure

```
mariadb-mcp/
├── .claude-plugin/
│   └── plugin.json
├── skills/
│   └── mariadb-best-practices/
│       ├── SKILL.md
│       └── references/
│           ├── schema-design.md
│           ├── indexing.md
│           ├── hidden-gotchas.md
│           ├── query-optimization.md
│           ├── hibernate-querydsl.md
│           ├── performance-tuning.md
│           ├── security-hardening.md
│           ├── backup-replication.md
│           └── migrations.md
├── commands/
│   ├── mariadb.md
│   └── mariadb-review.md
├── hooks/
│   ├── hooks.json
│   └── session-start.js
├── README.md
└── LICENSE
```

## SKILL.md

Acts as a router and methodology guide (~400 lines). Does NOT contain best practices directly. Instead:

1. Identifies the task type (schema design, query optimization, Hibernate review, performance diagnosis, etc.)
2. Directs the agent to read the relevant reference files
3. Provides a decision framework for common scenarios:
   - Before suggesting an index, check collation compatibility across joined columns
   - Before reviewing Hibernate entities, check fetch strategies and N+1 patterns
   - When analyzing EXPLAIN output, check for implicit type conversions
4. Instructs agent to use MariaDB MCP tools (if available) to validate recommendations against actual database state
5. Trigger phrases: "mariadb", "database schema", "hibernate mapping", "querydsl", "slow query", "index not used", "collation"

## Reference Files

### Content Sourcing Rules

Every reference file is built by web-search-researcher subagents fetching from primary sources only:
- `mariadb.com/kb/` — Official MariaDB Knowledge Base
- `dev.mysql.com/doc/` — Where MariaDB inherits MySQL/InnoDB behavior
- `docs.jboss.org/hibernate/` — Official Hibernate ORM docs
- `querydsl.com/static/querydsl/` — Official QueryDSL reference
- `github.com/MariaDB/` — Official repos for edge cases
- `mariadb.com/resources/blog/` — Official MariaDB team blog posts

No general blog posts or Stack Overflow. Each recommendation must trace to at least one official doc page with inline URL citations.

### Reference File Descriptions

1. **schema-design.md** — Data types (choosing correct types, VARCHAR vs TEXT, INT sizes, temporal precision), normalization levels, partitioning strategies, character set and collation selection at server/database/table/column level

2. **indexing.md** — B-tree vs hash index selection, composite index column ordering, covering indexes, prefix indexes and their limitations, partial indexes, duplicate/redundant index detection, index size limits by row format

3. **hidden-gotchas.md** — Collation mismatches making indexes unusable on JOINs, implicit type conversion bypassing indexes, `utf8` vs `utf8mb4` truncation, InnoDB row format impacts on index size limits, temporal type precision loss in Hibernate mappings, `ORDER BY` + `LIMIT` optimizer traps, subquery materialization behavior, silent data truncation on INSERT, character set coercion rules in WHERE clauses

4. **query-optimization.md** — Reading EXPLAIN/EXPLAIN ANALYZE output, common query anti-patterns, JOIN ordering, subquery vs JOIN performance, derived table materialization, index condition pushdown, MariaDB-specific optimizer hints, query cache behavior

5. **hibernate-querydsl.md** — Entity mapping best practices for MariaDB (type mappings, `@Column` definitions matching MariaDB types), fetch strategy selection (LAZY vs EAGER, `@BatchSize`, `@Fetch`), N+1 detection and prevention, QueryDSL patterns (proper `.fetchJoin()` usage, avoiding Cartesian products, pagination with `fetchCount()`, unbounded query prevention), second-level cache configuration, batch insert/update tuning, `hibernate.dialect` for MariaDB

6. **performance-tuning.md** — InnoDB buffer pool sizing, thread pool configuration, slow query log setup and analysis, `SHOW GLOBAL STATUS` key metrics, connection pool sizing (HikariCP defaults for MariaDB), monitoring queries (`SHOW PROCESSLIST`, `performance_schema`), table statistics and `ANALYZE TABLE`

7. **security-hardening.md** — Principle of least privilege for DB users, password policy, SSL/TLS enforcement, audit plugin, SQL injection prevention (parameterized queries in Hibernate/QueryDSL), network binding, `mysql.user` cleanup

8. **backup-replication.md** — `mariadb-backup` (Mariabackup) strategies, `mysqldump` for logical backups, point-in-time recovery with binary logs, GTID-based replication setup, semi-synchronous replication, MaxScale proxy, failover patterns

9. **migrations.md** — Flyway and Liquibase with MariaDB, zero-downtime DDL strategies (`ALTER TABLE` with `ALGORITHM=INPLACE` vs `COPY`), `pt-online-schema-change` for large tables, explicit collation in migration DDL, foreign key index requirements, rollback strategies

## Commands

### `/mariadb` — Guided Database Assessment

Requires MariaDB MCP connection. Runs a systematic health check:

1. **Schema audit** — Iterates tables via MCP, checks for: missing primary keys, inappropriate data types, inconsistent collations across related columns (JOINable columns with different collations), missing foreign keys where relationships exist
2. **Index analysis** — Duplicate/redundant indexes, missing indexes on foreign keys, indexes unusable due to collation mismatches or implicit type conversions, oversized indexes exceeding row format limits
3. **Configuration review** — InnoDB buffer pool sizing relative to data size, thread pool config, slow query log status, character set/collation defaults at server level
4. **Security scan** — Users with excessive privileges (`GRANT ALL`), accounts without passwords, missing SSL enforcement, anonymous users
5. **Output** — Prioritized report with severity levels (critical/warning/info) and specific fix recommendations, referencing relevant reference files for deeper context

### `/mariadb-review` — Codebase Review

Scans Java project source code (no MCP required):

1. **Hibernate entity scan** — Finds `@Entity` classes, checks for: missing `@Index` annotations, eager fetch where lazy is appropriate, N+1 query patterns (collection mappings without `@BatchSize`), incorrect cascade types, `@Column` definitions mismatched with MariaDB types (e.g., `String` without `length` mapping to default `VARCHAR(255)`)
2. **QueryDSL scan** — Finds QueryDSL usage, checks for: unbounded queries (no `.limit()`), missing `.fetchJoin()` on traversed associations, Cartesian product risks from multiple joins, string concatenation in predicates (SQL injection risk)
3. **Migration file scan** — Checks Flyway/Liquibase files for: DDL without explicit collation/charset, `ALTER TABLE` operations that will copy-lock large tables, missing index on new foreign key columns, data type changes that could truncate data
4. **Cross-reference** — If MCP available, compares entity definitions against actual table schemas to detect drift (column type mismatches, missing columns, extra columns)

## Session-Start Hook

`session-start.js` runs on SessionStart event:

1. Checks if MariaDB MCP tools are available in the session
2. If found, attempts `list_databases` to verify connectivity
3. Reports one of:
   - "MariaDB MCP detected and connected (databases: N)"
   - "MariaDB MCP detected but connection failed - check .env configuration"
   - "MariaDB MCP not detected - /mariadb unavailable, /mariadb-review (codebase-only) still works"

## plugin.json

```json
{
  "name": "mariadb-mcp",
  "version": "1.0.0",
  "description": "MariaDB MCP server integration with comprehensive best practices for schema design, indexing, query optimization, Hibernate/QueryDSL, and operations",
  "author": {
    "name": "Stefan Faur"
  },
  "license": "MIT",
  "keywords": ["mariadb", "mysql", "database", "mcp", "hibernate", "querydsl", "sql"]
}
```

## marketplace.json Entry

```json
{
  "name": "mariadb-mcp",
  "description": "MariaDB MCP integration with best practices for schema design, indexing, Hibernate/QueryDSL, and database operations",
  "version": "1.0.0",
  "source": "./mariadb-mcp",
  "category": "development"
}
```

## Implementation Order

1. Create plugin scaffold (plugin.json, directory structure)
2. Build all 9 reference files in parallel via web-search-researcher subagents (primary sources only)
3. Write SKILL.md (router/framework referencing the completed reference files)
4. Write `/mariadb` command
5. Write `/mariadb-review` command
6. Write session-start hook (hooks.json + session-start.js)
7. Update marketplace.json
8. Write README.md
