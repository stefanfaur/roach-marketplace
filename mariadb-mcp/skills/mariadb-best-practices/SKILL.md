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
