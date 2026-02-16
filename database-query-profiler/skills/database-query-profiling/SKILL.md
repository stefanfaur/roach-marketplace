---
name: database-query-profiling
description: |
  Use when you need to analyze, profile, or optimize database queries.
  This skill provides database query performance analysis with comprehensive guidance.
  Trigger with phrases like "profile queries", "optimize SQL", "find N+1 queries",
  "slow query analysis", "index recommendations", or "database performance".

allowed-tools: Read, Write, Edit, Grep, Glob, Bash(psql:*), Bash(mysql:*), Bash(sqlite3:*)
version: 1.0.0
author: Jeremy Longshore <jeremy@intentsolutions.io>
license: MIT
---
# Database Query Profiler

This skill provides automated database query performance analysis and optimization recommendations.

## Supported Databases

- PostgreSQL (EXPLAIN ANALYZE, pg_stat_statements)
- MySQL/MariaDB (EXPLAIN, slow query log, performance_schema)
- SQLite (EXPLAIN QUERY PLAN)
- ORM-generated queries (Django, SQLAlchemy, ActiveRecord, Prisma, TypeORM, Sequelize)

## Prerequisites

Before using this skill, ensure:
- Access to the codebase containing database queries
- Understanding of the application's data model
- Access to database for EXPLAIN analysis (optional but recommended)
- Knowledge of the ORM or query builder in use

## Instructions

### Step 1: Query Discovery
1. Search the codebase for all database query locations
2. Identify raw SQL queries, ORM calls, and query builder patterns
3. Map queries to their execution context (endpoints, background jobs, etc.)
4. Note query frequency (per-request, periodic, one-time)
5. Create a query inventory with file locations

### Step 2: N+1 Query Detection
1. Look for queries inside loops or list iterations
2. Identify ORM lazy-loading patterns that trigger N+1
3. Check for missing `select_related` / `prefetch_related` (Django)
4. Check for missing `includes` / `joins` / `eager_load` (ActiveRecord)
5. Check for missing `joinedload` / `subqueryload` (SQLAlchemy)
6. Check for missing `include` (Prisma) or `relations` (TypeORM)

### Step 3: Index Analysis
1. Identify columns used in WHERE, JOIN ON, ORDER BY, GROUP BY clauses
2. Check existing indexes against query patterns
3. Recommend composite indexes for multi-column filters
4. Identify unused or redundant indexes
5. Generate CREATE INDEX statements

### Step 4: Query Optimization
1. Analyze EXPLAIN plans for each problematic query
2. Identify full table scans and sequential scans
3. Check for inefficient join strategies
4. Look for unnecessary subqueries that could be joins
5. Identify queries returning more data than needed (SELECT *)
6. Recommend query rewrites with before/after examples

### Step 5: Connection and Configuration
1. Review connection pooling configuration
2. Check for connection leaks
3. Evaluate query timeout settings
4. Review database-specific tuning parameters
5. Recommend monitoring and alerting setup

## Output

This skill produces:

**Query Inventory**: Complete list of queries with file locations and frequency

**N+1 Report**: All N+1 patterns identified with exact code locations and fixes

**Index Recommendations**: CREATE INDEX statements with rationale

**Optimization Report**: Before/after query rewrites with EXPLAIN comparison

**Connection Analysis**: Pooling configuration recommendations

**Estimated Impact**: Performance improvement estimates for each recommendation

## Error Handling

**Cannot Access Database**:
- Analyze queries statically from code
- Provide index recommendations based on query patterns
- Note that EXPLAIN analysis requires database access

**ORM Abstraction**:
- Trace ORM calls to generated SQL
- Use ORM-specific debugging tools (Django debug toolbar, SQLAlchemy echo)
- Check ORM documentation for eager loading options

**Complex Queries**:
- Break down into sub-queries for analysis
- Check if query can be simplified or decomposed
- Consider materialized views for complex aggregations

## Resources

**PostgreSQL EXPLAIN**: https://www.postgresql.org/docs/current/sql-explain.html
**MySQL EXPLAIN**: https://dev.mysql.com/doc/refman/8.0/en/explain.html
**Use The Index, Luke**: https://use-the-index-luke.com/
