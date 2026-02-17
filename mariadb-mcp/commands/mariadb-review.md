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
