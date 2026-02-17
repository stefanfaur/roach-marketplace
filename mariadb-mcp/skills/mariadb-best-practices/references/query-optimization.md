# MariaDB Query Optimization Reference

Comprehensive guide to MariaDB and MySQL query optimization covering EXPLAIN/EXPLAIN ANALYZE analysis, common anti-patterns, join optimization, subquery strategies, advanced optimizations (ICP, MRR, BKA), optimizer configuration, and statistics management.

---

## Table of Contents

1. [Reading EXPLAIN Output](#reading-explain-output)
2. [Reading EXPLAIN ANALYZE Output](#reading-explain-analyze-output)
3. [Common Query Anti-Patterns](#common-query-anti-patterns)
4. [JOIN Optimization](#join-optimization)
5. [Subquery Optimization](#subquery-optimization)
6. [Derived Table Optimization](#derived-table-optimization)
7. [Advanced Optimizations](#advanced-optimizations)
8. [Optimizer Configuration](#optimizer-configuration)
9. [Statistics and ANALYZE TABLE](#statistics-and-analyze-table)
10. [Query Cache](#query-cache)

---

## Reading EXPLAIN Output

EXPLAIN provides the query execution plan, showing how MariaDB/MySQL will process your query.

**Source:** [MariaDB EXPLAIN Documentation](https://mariadb.com/kb/en/explain/) | [MySQL EXPLAIN Output Format](https://dev.mysql.com/doc/refman/8.4/en/explain-output.html)

### EXPLAIN Output Columns

#### 1. `id` Column
- Sequential number identifying each SELECT within the query
- Same `id` values indicate tables processed in the same operation
- Can be `NULL` for UNION results

#### 2. `select_type` Column

Indicates the query structure type:

| Value | Meaning |
|-------|---------|
| `SIMPLE` | Simple SELECT (no UNION or subqueries) |
| `PRIMARY` | Outermost SELECT |
| `UNION` | Second or later SELECT in UNION |
| `DEPENDENT UNION` | UNION dependent on outer query |
| `UNION RESULT` | Result of a UNION |
| `SUBQUERY` | First SELECT in subquery |
| `DEPENDENT SUBQUERY` | Subquery dependent on outer query |
| `DERIVED` | Derived table (subquery in FROM clause) |
| `DEPENDENT DERIVED` | Derived table dependent on another table |
| `MATERIALIZED` | Materialized subquery |
| `UNCACHEABLE SUBQUERY` | Result cannot be cached, re-evaluated per row |
| `UNCACHEABLE UNION` | Second+ SELECT in uncacheable UNION |

**Source:** [MySQL EXPLAIN Output Format](https://dev.mysql.com/doc/refman/8.4/en/explain-output.html)

#### 3. `table` Column
- Table name or alias being referenced
- Special values:
  - `<union_M_,_N_>`: Union of rows with id values M and N
  - `<derived_N_>`: Derived table result from subquery
  - `<subquery_N_>`: Materialized subquery result

#### 4. `partitions` Column
- Shows matching partitions for partitioned tables
- `NULL` for non-partitioned tables

#### 5. `type` Column (Access Method)

**Critical for performance analysis.** Ordered from best to worst:

| Type | Description | Performance |
|------|-------------|-------------|
| `system` | Table has only one row (special case of `const`) | ⭐⭐⭐⭐⭐ Best |
| `const` | At most one matching row, read at query start | ⭐⭐⭐⭐⭐ Best |
| `eq_ref` | One row read per combination from previous tables; uses PRIMARY KEY or UNIQUE NOT NULL | ⭐⭐⭐⭐ Excellent |
| `ref` | All rows with matching index values; uses non-UNIQUE index or leftmost prefix | ⭐⭐⭐⭐ Good |
| `fulltext` | JOIN using FULLTEXT index | ⭐⭐⭐ Good |
| `ref_or_null` | Like `ref` but also searches for NULL values | ⭐⭐⭐ Good |
| `index_merge` | Index Merge optimization; multiple indexes combined | ⭐⭐⭐ Good |
| `unique_subquery` | Replaces `eq_ref` for IN subqueries with primary key | ⭐⭐⭐ Good |
| `index_subquery` | Like `unique_subquery` for non-unique indexes | ⭐⭐⭐ Good |
| `range` | Rows in given range retrieved using index | ⭐⭐ Acceptable |
| `index` | Full index scan (covers all columns needed or scan in index order) | ⭐ Poor |
| `ALL` | Full table scan | ❌ Very Poor |

**Source:** [MySQL EXPLAIN Output Format](https://dev.mysql.com/doc/refman/8.4/en/explain-output.html)

#### 6. `possible_keys` Column
- Indexes MySQL/MariaDB could theoretically use
- `NULL` means no relevant indexes found
- Independent of table order in EXPLAIN output

#### 7. `key` Column
- The index actually chosen by the optimizer
- `NULL` if no index used (usually bad, indicates full table scan)
- May show an index not listed in `possible_keys` if it's a covering index

#### 8. `key_len` Column
- Length in bytes of the chosen key
- Shows how many parts of a multi-column index are used
- Higher values = more index columns used (generally better)
- **Important:** Nullable columns add one byte to key length

#### 9. `ref` Column
- Which columns or constants are compared to the index
- Shows the comparison value for index lookups
- Value `func` means a function result (use `SHOW WARNINGS` after EXPLAIN to see details)

#### 10. `rows` Column
- **Estimated** number of rows MySQL must examine
- For InnoDB, this is an estimate and may not be exact
- Multiply `rows` values across all tables to estimate total query cost
- Lower is better

#### 11. `filtered` Column
- Estimated percentage of table rows filtered by WHERE condition
- Range: 0-100 (100 = no filtering)
- Actual rows passed to next table = `rows × (filtered/100)`
- **Example:** rows=1000, filtered=50.00 → 500 rows passed forward

**Source:** [MySQL EXPLAIN Output Format](https://dev.mysql.com/doc/refman/8.4/en/explain-output.html)

#### 12. `Extra` Column

Critical information about query execution strategy:

| Extra Value | Meaning | Performance Impact |
|-------------|---------|-------------------|
| `Using where` | WHERE clause filters rows | Normal |
| `Using index` | **Covering index** - all data from index only | ⭐ Excellent |
| `Using index condition` | Index Condition Pushdown (ICP) active | ⭐ Good |
| `Using filesort` | Extra sorting pass required | ⚠️ Warning |
| `Using temporary` | Temporary table created | ⚠️ Warning |
| `Using join buffer (Block Nested Loop)` | Block Nested-Loop join | ⚠️ May need index |
| `Using join buffer (Batched Key Access)` | BKA optimization active | ⭐ Good |
| `Using join buffer (hash join)` | Hash join used | ⭐ Good |
| `Range checked for each record` | No good index found; range check per row | ❌ Very Poor |
| `Impossible WHERE` | WHERE clause always false | ⭐ Optimized away |
| `Impossible HAVING` | HAVING clause always false | ⭐ Optimized away |
| `Distinct` | Stops after first match per combination | Good |
| `FirstMatch(tbl_name)` | Semijoin FirstMatch strategy | Good |
| `Not exists` | LEFT JOIN optimization; stops after first match | ⭐ Good |
| `Backward index scan` | Using descending index (InnoDB) | Normal |
| `No tables used` | No FROM clause or FROM DUAL | Normal |

**Source:** [MySQL EXPLAIN Output Format](https://dev.mysql.com/doc/refman/8.4/en/explain-output.html) | [MariaDB EXPLAIN Documentation](https://mariadb.com/kb/en/explain/)

### Example EXPLAIN Analysis

```sql
EXPLAIN SELECT * FROM orders o
JOIN customers c ON o.customer_id = c.id
WHERE o.status = 'pending';
```

**Bad EXPLAIN output:**
```
table  type  possible_keys  key   rows    Extra
c      ALL   PRIMARY        NULL  100000  
o      ALL   customer_idx   NULL  500000  Using where; Using join buffer
```
**Problem:** Both tables use full table scans (type=ALL), join buffer needed
**Total cost:** 100,000 × 500,000 = 50 billion row examinations ❌

**Good EXPLAIN output:**
```
table  type    possible_keys      key          rows   Extra
o      ref     customer_idx,      status_idx   5000   Using index condition
                status_idx
c      eq_ref  PRIMARY            PRIMARY      1      
```
**Total cost:** 5,000 × 1 = 5,000 row examinations ✅

**Source:** [MySQL EXPLAIN Output Format](https://dev.mysql.com/doc/refman/8.4/en/explain-output.html)

---

## Reading EXPLAIN ANALYZE Output

**MariaDB-specific feature** that runs the query and annotates EXPLAIN with actual execution statistics.

**Source:** [MariaDB EXPLAIN ANALYZE Documentation](https://mariadb.com/kb/en/explain-analyze/) | [MariaDB ANALYZE Statement](https://mariadb.com/kb/en/analyze-statement/)

### Additional Columns in EXPLAIN ANALYZE

EXPLAIN ANALYZE adds execution statistics to regular EXPLAIN output:

| Column | Description |
|--------|-------------|
| `r_rows` | **Actual** number of rows read (average per execution) |
| `r_filtered` | **Actual** percentage of rows left after filtering |
| `r_loops` | Number of times this node executed (JSON format only) |
| `r_total_time_ms` | Total execution time in milliseconds (JSON format only) |

**Source:** [MariaDB EXPLAIN ANALYZE Documentation](https://mariadb.com/kb/en/explain-analyze/)

### Using EXPLAIN ANALYZE

```sql
ANALYZE SELECT * FROM orders WHERE status = 'pending';
```

### Comparing Estimates vs. Reality

| Column | Estimated | Actual (r_*) | Comparison |
|--------|-----------|--------------|------------|
| `rows` | Optimizer estimate | `r_rows` | Check accuracy |
| `filtered` | Estimated % | `r_filtered` | Check accuracy |

**If estimates differ significantly from actuals**, run `ANALYZE TABLE` to update statistics.

**Source:** [MariaDB ANALYZE Statement](https://mariadb.com/kb/en/analyze-statement/)

### ANALYZE FORMAT=JSON

For detailed timing information:

```sql
ANALYZE FORMAT=JSON
SELECT * FROM orders o
JOIN customers c ON o.customer_id = c.id;
```

Provides:
- `r_loops`: Execution count for each node
- `r_total_time_ms`: Time spent including subnodes
- Full execution tree with timing breakdown

**Source:** [MariaDB ANALYZE FORMAT=JSON](https://mariadb.com/kb/en/analyze-format-json/)

---

## Common Query Anti-Patterns

### 1. SELECT * (Retrieving Unnecessary Columns)

**Problem:** Wastes I/O, memory, and network bandwidth; prevents covering indexes.

```sql
-- Bad: Retrieves all columns
SELECT * FROM users WHERE email = 'user@example.com';

-- Good: Retrieve only needed columns
SELECT id, name, email FROM users WHERE email = 'user@example.com';
```

**Why it matters:**
- Prevents covering index optimization
- Wastes network bandwidth and memory
- Slower when columns contain BLOBs or large TEXT fields

**Source:** [MySQL SELECT Optimization](https://dev.mysql.com/doc/refman/8.4/en/select-optimization.html)

### 2. Implicit Type Conversion

**Problem:** Comparing columns to values of different types disables index usage.

**Source:** [MariaDB Type Conversion](https://mariadb.com/kb/en/type-conversion/)

#### String Column Compared to Numeric Value

```sql
-- Bad: VARCHAR compared to number - NO INDEX USED
SELECT * FROM users WHERE user_id = 123;  -- type: ALL (table scan)

-- Good: VARCHAR compared to string - INDEX USED
SELECT * FROM users WHERE user_id = '123';  -- type: ref (index)
```

**EXPLAIN comparison:**
- `WHERE a = 3` on VARCHAR column → `type: ALL` (full table scan)
- `WHERE a = '3'` on VARCHAR column → `type: ref` (index used)

**Source:** [MariaDB Type Conversion](https://mariadb.com/kb/en/type-conversion/)

#### Best Practice: Use Explicit CAST

```sql
-- Best: Explicit conversion
SELECT * FROM users WHERE user_id = CAST(123 AS CHAR);
```

**Rule:** Always match column data types in comparisons. Use `CAST()` for explicit conversions.

**Source:** [MariaDB Type Conversion](https://mariadb.com/kb/en/type-conversion/)

### 3. Functions on Indexed Columns

**Problem:** Applying functions to indexed columns in WHERE clauses prevents index usage.

```sql
-- Bad: Function on indexed column - NO INDEX USED
SELECT * FROM orders WHERE YEAR(created_at) = 2024;

-- Good: Rewrite to avoid function on column
SELECT * FROM orders 
WHERE created_at >= '2024-01-01' 
  AND created_at < '2025-01-01';
```

**Exception:** MariaDB supports virtual/generated columns with indexes:

```sql
-- Create generated column with index
ALTER TABLE orders 
  ADD COLUMN created_year INT AS (YEAR(created_at)) STORED;

CREATE INDEX idx_created_year ON orders(created_year);

-- Now this uses the index
SELECT * FROM orders WHERE created_year = 2024;
```

**Source:** [MariaDB Virtual Column Support](https://mariadb.com/kb/en/virtual-column-support-in-the-optimizer/)

### 4. Leading Wildcards in LIKE Queries

**Problem:** LIKE patterns starting with wildcard prevent index usage.

```sql
-- Bad: Leading wildcard - NO INDEX USED
SELECT * FROM products WHERE name LIKE '%phone%';

-- Good: No leading wildcard - INDEX USED
SELECT * FROM products WHERE name LIKE 'phone%';
```

**Solutions for full-text search:**
- Use MariaDB FULLTEXT indexes
- Use external search engine (Elasticsearch, etc.)
- Use trigram indexes (PostgreSQL) or similar solutions

**Source:** [MySQL SELECT Optimization](https://dev.mysql.com/doc/refman/8.4/en/select-optimization.html)

### 5. OR vs UNION

**Problem:** OR conditions on different columns often prevent efficient index usage.

```sql
-- Potentially inefficient: OR on different columns
SELECT * FROM users 
WHERE email = 'user@example.com' OR phone = '555-1234';
-- May use index_merge or full table scan

-- Often better: UNION with separate indexes
SELECT * FROM users WHERE email = 'user@example.com'
UNION
SELECT * FROM users WHERE phone = '555-1234';
-- Uses index on email in first query, index on phone in second
```

**When OR is acceptable:**
- OR conditions on the same column: `WHERE status IN ('pending', 'active')`
- When index_merge optimization is effective (check EXPLAIN)

**Source:** [MariaDB Index Merge Optimization](https://mariadb.com/kb/en/index_merge-sort_intersection/)

### 6. Correlated Subqueries

**Problem:** Subquery executes once per outer query row, causing performance issues.

```sql
-- Bad: Correlated subquery
SELECT u.name,
  (SELECT COUNT(*) FROM orders o WHERE o.user_id = u.id) AS order_count
FROM users u;
-- Subquery runs once per user

-- Good: JOIN with GROUP BY
SELECT u.name, COUNT(o.id) AS order_count
FROM users u
LEFT JOIN orders o ON o.user_id = u.id
GROUP BY u.id, u.name;
-- Single execution with grouping
```

**Exception:** MariaDB's Subquery Cache can optimize correlated subqueries automatically:

**Source:** [MariaDB Subquery Cache](https://mariadb.com/kb/en/subquery-cache/)

The cache stores results with correlation parameters to avoid re-execution. Monitor with:
- `Subquery_cache_hit`: Successful cache lookups
- `Subquery_cache_miss`: Cache misses

**Cache behavior based on hit rate:**
- < 20%: Cache disabled for expression
- 20-70%: Table cleared but stays in memory
- > 70%: Table converted to disk storage

Control with: `SET optimizer_switch='subquery_cache=off';`

**Source:** [MariaDB Subquery Cache](https://mariadb.com/kb/en/subquery-cache/)

### 7. NOT IN with Nullable Columns

**Problem:** NOT IN with subquery containing NULLs returns no results.

```sql
-- Dangerous: If orders.user_id contains NULL, returns nothing
SELECT * FROM users WHERE id NOT IN (SELECT user_id FROM orders);

-- Safe: Use NOT EXISTS or exclude NULLs
SELECT * FROM users u
WHERE NOT EXISTS (SELECT 1 FROM orders o WHERE o.user_id = u.id);

-- Or explicitly exclude NULLs
SELECT * FROM users 
WHERE id NOT IN (SELECT user_id FROM orders WHERE user_id IS NOT NULL);
```

**Source:** [MySQL SELECT Optimization](https://dev.mysql.com/doc/refman/8.4/en/select-optimization.html)

### 8. Inefficient Pagination with OFFSET

**Problem:** Large OFFSET values force MySQL/MariaDB to scan and discard rows.

```sql
-- Bad: Scans 1,000,000 rows then discards them
SELECT * FROM orders ORDER BY id LIMIT 100 OFFSET 1000000;

-- Good: Keyset pagination using last seen ID
SELECT * FROM orders 
WHERE id > 1000000  -- last_seen_id from previous page
ORDER BY id LIMIT 100;
```

**Source:** [MySQL LIMIT Optimization](https://dev.mysql.com/doc/refman/8.4/en/limit-optimization.html)

---

## JOIN Optimization

**Source:** [MariaDB JOIN Syntax](https://mariadb.com/kb/en/join-syntax/) | [MariaDB Optimizer Hints](https://mariadb.com/kb/en/optimizer-hints/)

### JOIN Ordering

The optimizer constructs join order left-to-right, trying to add tables to the join prefix.

**Default behavior:** Optimizer chooses join order automatically based on:
- Table sizes (statistics)
- Index availability
- Condition selectivity

### Controlling JOIN Order with STRAIGHT_JOIN

Force the optimizer to use tables in the order specified:

```sql
-- Force join order: t1 → t2 → t3
SELECT STRAIGHT_JOIN t1.*, t2.*, t3.*
FROM t1, t2, t3
WHERE t1.id = t2.t1_id AND t2.id = t3.t2_id;

-- Alternative syntax
SELECT * FROM t1
STRAIGHT_JOIN t2 ON t1.id = t2.t1_id
STRAIGHT_JOIN t3 ON t2.id = t3.t2_id;
```

**Use when:**
- You have better knowledge of data distribution than the optimizer
- Optimizer consistently chooses wrong join order
- Testing specific join strategies

**Source:** [MariaDB Optimizer Hints](https://mariadb.com/kb/en/optimizer-hints/)

### JOIN Execution Mechanisms

#### Nested Loop Join (NLJ)
Default join algorithm. For each row in outer table, search matching rows in inner table.

**Best when:**
- Inner table has effective index on join column
- Result set is small
- Indexes provide `eq_ref` or `ref` access

#### Block Nested Loop (BNL)
Used when no index available on inner table. Reads outer table rows into join buffer, then scans inner table once.

**Indicated by:** `Using join buffer (Block Nested Loop)` in EXPLAIN Extra column

**Configuration:**
- `join_buffer_size`: Memory per table
- `join_cache_level`: Join cache strategy (0-8)

**Source:** [MariaDB Server System Variables](https://mariadb.com/kb/en/server-system-variables/)

#### Hash Join
MariaDB supports hash join for equi-joins without indexes.

**Configuration:**
- Requires `join_cache_level = 3` or higher
- For large queries: `join_cache_level = 8`

**Source:** [MariaDB Big Query Settings](https://mariadb.com/kb/en/big-query-settings/)

**Optimizer switch:** `hash_join_cardinality=on` enables histogram-based cardinality estimation for hash joins.

**Source:** [MariaDB hash_join_cardinality Flag](https://mariadb.com/kb/en/hash_join_cardinality-optimizer_switch-flag/)

### JOIN Cache Levels

**Source:** [MariaDB Server System Variables](https://mariadb.com/kb/en/server-system-variables/)

`join_cache_level` values:
- **0**: Disabled
- **1**: Incremental Block Nested Loop (BNL)
- **2**: Flat BNL (default)
- **3**: Flat Block Nested Loop Hash (BNLH)
- **4**: Incremental BNLH
- **5**: Flat Batched Key Access (BKA)
- **6**: Incremental BKA
- **7**: Flat Batched Key Access Hash (BKAH)
- **8**: Incremental BKAH

**For IO-bound large queries:** Set `join_cache_level = 8`

### JOIN Optimizer Hints

```sql
-- Force specific index usage
SELECT * FROM t1
JOIN t2 FORCE INDEX (idx_join_column) ON t1.id = t2.t1_id;

-- Suggest index usage
SELECT * FROM t1
JOIN t2 USE INDEX (idx_join_column) ON t1.id = t2.t1_id;

-- Ignore specific index
SELECT * FROM t1
JOIN t2 IGNORE INDEX (idx_other) ON t1.id = t2.t1_id;
```

**Source:** [MariaDB Index Hints](https://mariadb.com/kb/en/index-hints-how-to-force-query-plans/)

### Best Practices for JOINs

1. **Ensure indexes on join columns** (both sides)
2. **Match data types** (avoid implicit conversions)
3. **Match collations** (collation mismatch disables indexes)
4. **Use EXPLAIN** to verify index usage (look for `eq_ref` or `ref` types)
5. **Consider join order** (smaller tables first, then larger filtered tables)
6. **Avoid joining on expressions** (e.g., `ON UPPER(t1.col) = UPPER(t2.col)`)

**Source:** [MySQL SELECT Optimization](https://dev.mysql.com/doc/refman/8.4/en/select-optimization.html)

---

## Subquery Optimization

MariaDB implements sophisticated subquery optimizations that often eliminate the need for manual rewrites.

**Source:** [MariaDB Subquery Optimizations](https://mariadb.com/kb/en/subquery-optimizations/)

### Semi-Join Subqueries

Semi-join optimizations apply to `IN (SELECT ...)` and `EXISTS` subqueries in WHERE/ON clauses.

**Source:** [MariaDB Semi-join Optimizations](https://mariadb.com/kb/en/semi-join-subquery-optimizations/)

#### Semi-Join Strategies

MariaDB supports five semi-join strategies:

1. **Table Pullout**
   - Converts subquery to regular JOIN
   - No duplicates possible (e.g., subquery uses PRIMARY KEY/UNIQUE)
   - **Automatic optimization** - manual rewrites unnecessary
   
   **Source:** [MariaDB Table Pullout Optimization](https://mariadb.com/kb/en/table-pullout-optimization/)

2. **FirstMatch**
   - Similar to `EXISTS`: stops scanning after first match
   - Shown in EXPLAIN Extra: `FirstMatch(table_name)`

3. **LooseScan**
   - Uses index to scan unique values only
   - Efficient for IN subqueries on indexed columns

4. **Materialization**
   - Executes subquery once, stores result in temporary table with index
   - Efficient when subquery result is small
   
   **Source:** [MariaDB Semi-join Materialization](https://mariadb.com/kb/en/semi-join-materialization-strategy/)

5. **DuplicateWeedout**
   - Uses temporary table to eliminate duplicates
   - Fallback strategy when others don't apply

**Control via optimizer_switch:**
```sql
-- Enable all semi-join strategies (default)
SET optimizer_switch='semijoin=on';

-- Disable specific strategies
SET optimizer_switch='materialization=off';
SET optimizer_switch='firstmatch=off';
```

**Source:** [MariaDB Semi-join Optimizations](https://mariadb.com/kb/en/semi-join-subquery-optimizations/)

### Non-Semi-Join Subqueries

For subqueries that cannot be optimized as semi-joins (e.g., in SELECT clause, UNION, NOT IN).

**Source:** [MariaDB Non-semi-join Optimizations](https://mariadb.com/kb/en/non-semi-join-subquery-optimizations/)

#### Non-Semi-Join Strategies

1. **Materialization (Outside-In)**
   - Execute subquery once, materialize result
   - Only for non-correlated subqueries
   - Result stored in temporary table with index on all columns
   - **Best when:** Subquery result fits in memory
   
2. **In-to-Exists Transformation**
   - Converts IN to EXISTS-style correlated subquery
   - Works for both correlated and non-correlated subqueries
   - Legacy strategy from older MySQL/MariaDB versions

**Performance example from MariaDB documentation:**
- Query requiring "more than one hour" in MySQL 5.x
- Completed "in less than a minute" with MariaDB 5.3 materialization
- Another example: **20× speedup** with partial matching algorithms

**Source:** [MariaDB Non-semi-join Optimizations](https://mariadb.com/kb/en/non-semi-join-subquery-optimizations/)

### Subquery vs JOIN Performance

**General guideline from MariaDB:**
> "Common advice for optimizing MySQL has been 'If possible, rewrite your subqueries as joins', and table pullout does exactly that, so manual rewrites are no longer necessary."

**Source:** [MariaDB Table Pullout Optimization](https://mariadb.com/kb/en/table-pullout-optimization/)

**When to use subqueries:**
- Modern MariaDB optimizes them automatically
- Often more readable than complex JOINs
- Optimizer handles transformation internally

**When to rewrite as JOIN:**
- Subquery cannot be optimized (check EXPLAIN)
- Correlated subquery with poor cache hit rate
- NOT IN with nullable columns (use NOT EXISTS or LEFT JOIN instead)

### Subquery Cache for Correlated Subqueries

**Source:** [MariaDB Subquery Cache](https://mariadb.com/kb/en/subquery-cache/)

MariaDB caches correlated subquery results to avoid re-execution:

**How it works:**
- Creates temporary table with results + correlation parameters
- Unique index on all parameters
- Starts as MEMORY table, converts to disk if needed

**Cache sizing:**
- Initial size: MEMORY table up to `MIN(tmp_table_size, max_heap_table_size)`
- When limit reached, hit rate checked:
  - **< 20%**: Cache disabled
  - **20-70%**: Table cleared, stays in memory
  - **> 70%**: Converted to disk table

**Monitoring:**
```sql
SHOW STATUS LIKE 'Subquery_cache%';
-- Subquery_cache_hit: Successful lookups
-- Subquery_cache_miss: Cache misses
```

**Hit rate calculation:** `hit / (hit + miss)`

**Real-world performance:**
- Example 1: **5445× speedup** with 99.98% hit rate
- Example 4: 0% hit rate, no benefit

**Control:**
```sql
SET optimizer_switch='subquery_cache=off';  -- Disable
```

**Source:** [MariaDB Subquery Cache](https://mariadb.com/kb/en/subquery-cache/)

---

## Derived Table Optimization

Derived tables are subqueries in the FROM clause.

**Source:** [MariaDB Optimizations for Derived Tables](https://mariadb.com/kb/en/optimizations-for-derived-tables/)

### Derived Table Strategies

#### 1. Derived Table Merge

**When possible**, MariaDB merges derived table into parent SELECT.

**Requirements:**
- No grouping (GROUP BY)
- No aggregates (SUM, COUNT, etc.)
- No ORDER BY ... LIMIT

**Benefit:** Eliminates temporary table materialization.

**Source:** [MariaDB Derived Table Merge](https://mariadb.com/kb/en/derived-table-merge-optimization/)

**Control via optimizer_switch:**
```sql
SET optimizer_switch='derived_merge=on';  -- Default
```

**Source:** [MariaDB optimizer_switch](https://mariadb.com/kb/en/optimizer-switch/)

#### 2. Derived Table with Keys

When derived table cannot be merged, MariaDB can create indexes on the temporary table.

**Benefit:** Enables efficient joins with other tables.

**Available since:** MariaDB 5.3 / MySQL 5.6

**Source:** [MariaDB Derived Table with Key Optimization](https://mariadb.com/kb/en/derived-table-with-key-optimization/)

**Control via optimizer_switch:**
```sql
SET optimizer_switch='derived_with_keys=on';  -- Default
```

**Source:** [MariaDB optimizer_switch](https://mariadb.com/kb/en/optimizer-switch/)

#### 3. Condition Pushdown for Derived Tables

Pushes WHERE conditions from outer query into derived table to reduce result set early.

**Benefit:** Fewer rows materialized in temporary table.

**Source:** [MariaDB Optimizations for Derived Tables](https://mariadb.com/kb/en/optimizations-for-derived-tables/)

**Control via optimizer_switch:**
```sql
SET optimizer_switch='condition_pushdown_for_derived=on';  -- Default
```

**Source:** [MariaDB optimizer_switch](https://mariadb.com/kb/en/optimizer-switch/)

#### 4. Lateral Derived Optimization (Split Materialized)

Optimizes derived tables with GROUP BY by splitting grouping into stages.

**Also known as:** Split Grouping Optimization, Split Materialized Optimization

**Source:** [MariaDB Lateral Derived Optimization](https://mariadb.com/kb/en/lateral-derived-optimization/)

**Control via optimizer_switch:**
```sql
SET optimizer_switch='split_materialized=on';  -- Default
```

**Source:** [MariaDB optimizer_switch](https://mariadb.com/kb/en/optimizer-switch/)

### Best Practices for Derived Tables

1. **Avoid unnecessary derived tables** - Use JOINs directly when possible
2. **Use meaningful aliases** for readability
3. **Check EXPLAIN** - Verify whether derived table is merged or materialized
4. **Reduce derived table size** - Apply filters inside derived table when possible
5. **Consider CTEs (WITH clause)** for readability in MariaDB 10.2+

```sql
-- Common Table Expression (CTE) - more readable
WITH recent_orders AS (
  SELECT * FROM orders WHERE created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
)
SELECT u.name, COUNT(o.id) AS order_count
FROM users u
JOIN recent_orders o ON o.user_id = u.id
GROUP BY u.id, u.name;
```

**Source:** [MariaDB Optimizations for Derived Tables](https://mariadb.com/kb/en/optimizations-for-derived-tables/)

---

## Advanced Optimizations

### Index Condition Pushdown (ICP)

**What it is:** Evaluates WHERE clause conditions at the index level, before fetching full table rows.

**Benefit:** Reduces disk I/O by skipping rows that don't match WHERE conditions.

**Source:** [MariaDB Index Condition Pushdown](https://mariadb.com/kb/en/index-condition-pushdown/) | [MySQL Index Condition Pushdown](https://dev.mysql.com/doc/refman/8.4/en/index-condition-pushdown-optimization.html)

#### How ICP Works

**Without ICP:**
1. Scan index to find matching rows
2. Fetch full row from table
3. Evaluate WHERE condition
4. Return row if condition matches

**With ICP:**
1. Scan index
2. **Evaluate index-compatible WHERE conditions immediately**
3. **Only fetch full row if conditions pass**
4. Return row

#### When ICP Applies

**Access methods:** `range`, `ref`, `eq_ref`, `ref_or_null`, Batched Key Access

**Best for:**
- Multi-column indexes where:
  - First column(s) used for index access
  - Subsequent columns have filter conditions
- Large table records or BLOB columns (high fetch cost)

**Performance example from MariaDB DBT-3 benchmark:**
- **Cold buffer pool:** 5 minutes → 1 minute (80% reduction)
- **Hot buffer pool:** 0.19s → 0.07s (63% reduction)

**Source:** [MariaDB Index Condition Pushdown](https://mariadb.com/kb/en/index-condition-pushdown/)

#### Configuration

```sql
-- ICP is ON by default
SET optimizer_switch='index_condition_pushdown=on';

-- Disable for specific query
SET optimizer_switch='index_condition_pushdown=off';
```

**Source:** [MariaDB optimizer_switch](https://mariadb.com/kb/en/optimizer-switch/)

#### Identifying ICP in EXPLAIN

Look for **"Using index condition"** in Extra column:

```sql
EXPLAIN SELECT * FROM orders 
WHERE status = 'pending' AND created_at > '2024-01-01';

-- Extra: Using index condition
```

**Source:** [MySQL Index Condition Pushdown](https://dev.mysql.com/doc/refman/8.4/en/index-condition-pushdown-optimization.html)

#### Monitoring ICP

```sql
SHOW STATUS LIKE 'Handler_icp%';
-- Handler_icp_attempts: Total condition checks
-- Handler_icp_match: Successful matches
```

**Effectiveness metric:** Lower ratio of `attempts` to `match` = better filtering.

**Source:** [MariaDB Index Condition Pushdown](https://mariadb.com/kb/en/index-condition-pushdown/)

#### ICP Limitations

1. **Virtual column indexes cannot use ICP**
   - **Workaround:** Use `STORED` generated columns instead
   
2. **Backward index scans disable ICP**
   - ORDER BY ... DESC queries using backward scan
   
3. **Partitioned tables:** Supported since MariaDB 11.5

**Source:** [MariaDB Index Condition Pushdown](https://mariadb.com/kb/en/index-condition-pushdown/)

### Multi-Range Read (MRR) Optimization

**What it is:** Sorts disk access requests to enable sequential reads instead of random access.

**Benefit:** Dramatically improves performance on rotating disks; reduces buffer pool thrashing.

**Source:** [MariaDB Multi-Range Read Optimization](https://mariadb.com/kb/en/multi-range-read-optimization/)

#### MRR Strategies

##### 1. Rowid-Ordered Scan
- Sorts record requests by physical location on disk
- Enables sequential disk sweep instead of random seeks
- Prevents repeated buffer pool/cache hits

##### 2. Key-Ordered Scan
- Sorts lookup keys before index access
- Minimizes redundant page reads during joins
- Effective when join cache hit ratio is poor

**Source:** [MariaDB Multi-Range Read Optimization](https://mariadb.com/kb/en/multi-range-read-optimization/)

#### When to Enable MRR

**MRR benefits:**
- Range queries accessing large datasets
- Joins using index lookups (via Batched Key Access)
- Queries on large tables exceeding cache capacity
- IO-bound workloads on rotating disks

**Avoid MRR for:**
- Small datasets fitting in OS cache
- `LIMIT n` queries with small n
- `ORDER BY ... LIMIT n` (MRR reads in disk order, not index order)
- SSD storage (less benefit than HDDs)

**Source:** [MariaDB Multi-Range Read Optimization](https://mariadb.com/kb/en/multi-range-read-optimization/)

#### MRR Configuration

**For range access:**
```sql
SET mrr_buffer_size = 262144;  -- Buffer per table (bytes)
```

**For Batched Key Access (BKA):**
```sql
SET join_buffer_size = 262144;           -- Memory per table
SET join_buffer_space_limit = 2097152;   -- Total memory across tables
SET join_cache_level = 6;                -- Enable BKA
```

**Optimizer switches:**
```sql
SET optimizer_switch='mrr=on';              -- Enable MRR with rowid ordering
SET optimizer_switch='mrr_sort_keys=on';    -- Enable key-ordered scans
SET optimizer_switch='mrr_cost_based=off';  -- Force MRR (not recommended)
```

**Source:** [MariaDB Multi-Range Read Optimization](https://mariadb.com/kb/en/multi-range-read-optimization/)

#### Monitoring MRR

```sql
SHOW STATUS LIKE 'Handler_mrr%';
-- Handler_mrr_init: Total MRR scans
-- Handler_mrr_key_refills: Key buffer refills
-- Handler_mrr_rowid_refills: Rowid buffer refills
```

**Performance indicator:** Non-zero refill counts mean insufficient buffer memory. Increase buffer sizes for single-pass execution.

**Source:** [MariaDB Multi-Range Read Optimization](https://mariadb.com/kb/en/multi-range-read-optimization/)

### Batched Key Access (BKA)

**What it is:** Batches join operations and uses MRR for disk-ordered access.

**How it works:**
1. Accumulate join keys in buffer
2. Sort keys for sequential access
3. Use MRR to fetch matching rows in disk order

**Benefit:** Reduces random I/O during joins.

**Source:** [MariaDB Multi-Range Read Optimization](https://mariadb.com/kb/en/multi-range-read-optimization/)

**Configuration:**
```sql
SET join_cache_level = 6;  -- Enable incremental BKA
SET join_cache_level = 8;  -- Incremental BKA with hash (for large queries)
```

**Source:** [MariaDB Big Query Settings](https://mariadb.com/kb/en/big-query-settings/)

**Identified in EXPLAIN:** `Using join buffer (Batched Key Access)`

**Buffer management:** BKA manages buffer space, automatically provides portion to MRR.

**Source:** [MariaDB Multi-Range Read Optimization](https://mariadb.com/kb/en/multi-range-read-optimization/)

### Hash Join

**Available in MariaDB** for equi-joins without suitable indexes.

**Source:** [MariaDB Big Query Settings](https://mariadb.com/kb/en/big-query-settings/)

**Configuration:**
```sql
SET join_cache_level = 3;  -- Enable flat Block Nested Loop Hash
SET join_cache_level = 8;  -- Incremental BKA Hash (recommended for large queries)
```

**For large IO-bound queries (>30% table examination):**
```sql
SET join_cache_level = 8;
```

**Source:** [MariaDB Big Query Settings](https://mariadb.com/kb/en/big-query-settings/)

**Optimizer switch:**
```sql
SET optimizer_switch='hash_join_cardinality=on';  -- Use histograms for cardinality estimation
```

**Available since:** MariaDB 11.0.2, 10.11.3, 10.10.4, 10.9.6, 10.8.8, 10.6.13

**Source:** [MariaDB hash_join_cardinality Flag](https://mariadb.com/kb/en/hash_join_cardinality-optimizer_switch-flag/)

**Identified in EXPLAIN:** `Using join buffer (hash join)`

### Index Merge Optimization

**What it is:** Combines multiple indexes on the same table to satisfy a query.

**Source:** [MariaDB Index Merge Sort Intersection](https://mariadb.com/kb/en/index_merge-sort_intersection/)

#### Index Merge Strategies

##### 1. Union
- Combines results from multiple indexes using OR logic
- `index_merge_union=on` (default)

##### 2. Intersection
- Combines results using AND logic
- Requires rowid-ordered index scans
- `index_merge_intersection=on` (default)

##### 3. Sort-Union
- Sorts index results before union
- `index_merge_sort_union=on` (default)

##### 4. Sort-Intersection
- Sorts before intersection
- Handles non-equality conditions
- Higher overhead than regular intersection
- Best for large tables with large intersections
- **OFF by default** (enable with `index_merge_sort_intersection=on`)

**Source:** [MariaDB Index Merge Sort Intersection](https://mariadb.com/kb/en/index_merge-sort_intersection/)

**Example EXPLAIN output:**
```
type: index_merge
possible_keys: idx_status,idx_date
key: idx_status,idx_date
Extra: Using union(idx_status,idx_date); Using where
```

**Configuration:**
```sql
SET optimizer_switch='index_merge=on';                     -- Master switch
SET optimizer_switch='index_merge_union=on';
SET optimizer_switch='index_merge_intersection=on';
SET optimizer_switch='index_merge_sort_union=on';
SET optimizer_switch='index_merge_sort_intersection=off';  -- Default OFF
```

**Source:** [MariaDB optimizer_switch](https://mariadb.com/kb/en/optimizer-switch/)

### Covering Index Optimization

**What it is:** Query satisfied entirely from index, without accessing table data.

**Source:** [MariaDB Building the Best Index](https://mariadb.com/kb/en/building-the-best-index-for-a-given-select/)

**Identified in EXPLAIN:** `Using index` in Extra column

**Example:**
```sql
-- Table: users (id, email, name, status)
-- Index: idx_covering (status, email, name)

SELECT email, name FROM users WHERE status = 'active';
-- All columns (status, email, name) in index
-- EXPLAIN Extra: Using index
```

**How to create covering indexes:**

1. **Start with WHERE/JOIN columns** (for filtering)
2. **Add SELECT columns** to end (for covering)

```sql
-- Query needs filtering + retrieval
SELECT x, z FROM t WHERE y = 5 AND q = 7;

-- Optimal covering index: filter columns first, then SELECT columns
CREATE INDEX idx_covering ON t(y, q, x, z);
-- y, q: filtering
-- x, z: covering
```

**Source:** [MariaDB Building the Best Index](https://mariadb.com/kb/en/building-the-best-index-for-a-given-select/)

**Benefits:**
- No table data access required
- Faster query execution
- Reduced I/O

**Trade-offs:**
- Larger index size
- Slower writes (more index maintenance)
- Disk space usage

### Table Elimination

**What it is:** Optimizer removes unnecessary joined tables from query execution.

**Source:** [MariaDB Table Elimination](https://mariadb.com/kb/en/table-elimination/)

**When it applies:**
- LEFT JOIN to table whose columns aren't used in result
- Joined table has PRIMARY KEY/UNIQUE constraint ensuring one-to-one relationship

**Example:**
```sql
SELECT u.name 
FROM users u
LEFT JOIN orders o ON o.user_id = u.id;
-- If orders columns not used, optimizer eliminates orders table

-- Check with EXPLAIN: orders table won't appear
```

**Benefits:**
- Faster execution (fewer tables accessed)
- Never makes query slower
- No optimization opportunities lost

**Verification:**
```sql
EXPLAIN SELECT ...;
-- Eliminated tables won't appear in output
```

**Configuration:**
```sql
SET optimizer_switch='table_elimination=on';  -- Default
```

**Source:** [MariaDB optimizer_switch](https://mariadb.com/kb/en/optimizer-switch/) | [MariaDB Table Elimination](https://mariadb.com/kb/en/table-elimination/)

**Available in:** MariaDB (also in Microsoft SQL Server, Oracle 11g)

**Source:** [MariaDB Table Elimination](https://mariadb.com/kb/en/table-elimination/)

---

## Optimizer Configuration

MariaDB's `optimizer_switch` controls query optimization features via on/off flags.

**Source:** [MariaDB optimizer_switch Documentation](https://mariadb.com/kb/en/optimizer-switch/)

### Setting optimizer_switch

```sql
-- Session-level
SET SESSION optimizer_switch='flag1=on,flag2=off';

-- Global-level (affects new connections)
SET GLOBAL optimizer_switch='flag1=on,flag2=off';

-- View current settings
SELECT @@optimizer_switch;
SHOW VARIABLES LIKE 'optimizer_switch';
```

### Complete optimizer_switch Flags

| Flag | Default | Purpose |
|------|---------|---------|
| `condition_pushdown_for_derived` | ON | Push conditions into derived tables |
| `condition_pushdown_for_subquery` | ON | Push conditions into IN subqueries |
| `condition_pushdown_from_having` | ON | Push HAVING clause conditions down |
| `cset_narrowing` | ON (11.7+) | Character set optimization |
| `derived_merge` | ON | Merge derived tables into outer query |
| `derived_with_keys` | ON | Add keys to derived tables |
| `duplicateweedout` | ON (12.0+) | Remove duplicate rows in semi-joins |
| `exists_to_in` | ON | Convert EXISTS to IN predicates |
| `extended_keys` | ON | Use extended keys in optimization |
| `firstmatch` | ON | First-match semi-join strategy |
| `hash_join_cardinality` | ON (11.0+) | Histogram-based hash join cardinality |
| `index_condition_pushdown` | ON | Index Condition Pushdown (ICP) |
| `index_merge` | ON | Combine multiple indexes |
| `index_merge_intersection` | ON | Index merge intersection |
| `index_merge_sort_intersection` | OFF | Sort before intersection merge |
| `index_merge_sort_union` | ON | Sort before union merge |
| `index_merge_union` | ON | Index merge union |
| `in_to_exists` | ON | Convert IN to EXISTS subqueries |
| `join_cache_bka` | ON | Batched Key Access |
| `join_cache_hashed` | ON | Hashed join buffer access |
| `join_cache_incremental` | ON | Incremental join cache updates |
| `loosescan` | ON | Loose index scan strategy |
| `materialization` | ON | Materialize semi-join/non-semi-join subqueries |
| `mrr` | OFF | Multi-Range Read optimization |
| `mrr_cost_based` | OFF | Cost-based MRR decisions |
| `mrr_sort_keys` | OFF | Sort keys in MRR |
| `not_null_range_scan` | OFF | Non-NULL range scans |
| `optimize_join_buffer_size` | ON | Dynamic join buffer sizing |
| `orderby_uses_equalities` | ON | Use equality conditions in ORDER BY |
| `outer_join_with_cache` | ON | Cache outer join results |
| `partial_match_rowid_merge` | ON | Row ID merge for partial matches |
| `partial_match_table_scan` | ON | Table scan for partial matches |
| `rowid_filter` | ON | Early row ID filtering |
| `sargable_casefold` | ON (11.3+) | UPPER/LOWER in WHERE clauses |
| `semijoin` | ON | Semi-join optimization |
| `semijoin_with_cache` | ON | Cache semi-join results |
| `split_materialized` | ON | Split materialized lateral derives |
| `subquery_cache` | ON | Cache subquery results |
| `table_elimination` | ON | Remove unnecessary tables |

**Source:** [MariaDB optimizer_switch Documentation](https://mariadb.com/kb/en/optimizer-switch/)

### Recommendations

**Generally keep ON (defaults):**
- Most optimizations are beneficial for typical workloads
- Disable only when experiencing specific issues

**Consider disabling:**
- `materialization=off`: If causing memory pressure with large subquery results
- `mrr=on`: Enable only when beneficial (IO-bound queries on HDDs)
- `mrr_cost_based=off`: Force MRR usage (usually keep OFF for manual control)
- `index_merge_sort_intersection=on`: Enable for large tables with beneficial intersections

**Diagnostic workflow:**
1. Use EXPLAIN to analyze query plans
2. Test specific flags on/off
3. Measure execution time and resource usage
4. Adjust based on workload characteristics

**Source:** [MariaDB optimizer_switch Documentation](https://mariadb.com/kb/en/optimizer-switch/)

### Related Configuration Variables

**JOIN-related:**
```sql
SET join_buffer_size = 262144;           -- Per-table join buffer
SET join_buffer_space_limit = 2097152;   -- Total join buffer limit
SET join_cache_level = 2;                -- Join cache strategy (0-8)
```

**MRR-related:**
```sql
SET mrr_buffer_size = 262144;            -- MRR buffer per table
```

**Subquery cache:**
```sql
SET tmp_table_size = 16777216;           -- Max MEMORY temp table size
SET max_heap_table_size = 16777216;      -- Max HEAP table size
```

**Source:** [MariaDB Server System Variables](https://mariadb.com/kb/en/server-system-variables/)

---

## Statistics and ANALYZE TABLE

Query optimizer relies on table statistics to choose efficient execution plans. Stale statistics lead to poor query performance.

**Source:** [MariaDB ANALYZE TABLE Documentation](https://mariadb.com/kb/en/analyze-table/) | [MariaDB Engine-Independent Statistics](https://mariadb.com/kb/en/engine-independent-table-statistics/)

### ANALYZE TABLE Syntax

```sql
-- Basic syntax (updates index statistics)
ANALYZE TABLE table_name;

-- Multiple tables
ANALYZE TABLE table1, table2, table3;

-- Disable binary log recording
ANALYZE NO_WRITE_TO_BINLOG TABLE table_name;
ANALYZE LOCAL TABLE table_name;  -- Alias
```

**Source:** [MariaDB ANALYZE TABLE Documentation](https://mariadb.com/kb/en/analyze-table/)

### What ANALYZE TABLE Does

- **Analyzes and stores key distribution** for MyISAM, Aria, InnoDB
- Updates index statistics used by optimizer
- Helps optimizer decide:
  - Join order for multi-table queries
  - Which indexes to use
  - Condition selectivity

**Source:** [MariaDB ANALYZE TABLE Documentation](https://mariadb.com/kb/en/analyze-table/)

### Engine-Independent Statistics (PERSISTENT FOR)

Standard ANALYZE TABLE only collects engine-specific statistics. For advanced optimizer features, use **engine-independent statistics**.

**Source:** [MariaDB Engine-Independent Statistics](https://mariadb.com/kb/en/engine-independent-table-statistics/)

```sql
-- Collect statistics for ALL columns and indexes (expensive!)
ANALYZE TABLE orders PERSISTENT FOR ALL;

-- Collect statistics for specific columns
ANALYZE TABLE orders PERSISTENT FOR COLUMNS(status, created_at);

-- Collect statistics for specific indexes
ANALYZE TABLE orders PERSISTENT FOR INDEXES(idx_status);

-- Combination
ANALYZE TABLE orders PERSISTENT FOR 
  COLUMNS(status, user_id) 
  INDEXES(idx_status, idx_user);
```

**Source:** [MariaDB ANALYZE TABLE Documentation](https://mariadb.com/kb/en/analyze-table/)

**Storage:** Statistics stored in `mysql.table_stats`, `mysql.column_stats`, `mysql.index_stats`

**Source:** [MariaDB Engine-Independent Statistics](https://mariadb.com/kb/en/engine-independent-table-statistics/)

### Histogram-Based Statistics

Histograms provide selectivity information for non-indexed columns, enabling better query plans.

**Source:** [MariaDB Histogram-Based Statistics](https://mariadb.com/kb/en/histogram-based-statistics/)

**Histogram types:**
- **SINGLE_PREC_HB**: Single precision height-balanced
- **DOUBLE_PREC_HB**: Double precision height-balanced (default since 10.4.3)
- **JSON_HB**: JSON format (accepted since 10.8)

**Configuration:**
```sql
-- Set histogram size (0-255 bytes = number of bins)
SET histogram_size = 254;  -- Default varies by version (0 in 10.4.2 and earlier)

-- Set histogram type
SET histogram_type = 'DOUBLE_PREC_HB';  -- Default since 10.4.3

-- Control optimizer usage
SET optimizer_use_condition_selectivity = 4;  -- Default since 10.4.1
-- 4 = Use histograms for all range predicates
```

**Source:** [MariaDB Histogram-Based Statistics](https://mariadb.com/kb/en/histogram-based-statistics/)

**Creating histograms:**
```sql
-- Histograms NOT collected automatically (requires full table scan)
ANALYZE TABLE orders PERSISTENT FOR COLUMNS(status);
```

**When to use:**
- Non-indexed columns used in WHERE clauses
- Columns with skewed data distribution
- Optimizer choosing wrong index

**Benefit:** Enables optimizer to recognize highly selective conditions on non-indexed columns.

**Source:** [MariaDB Histogram-Based Statistics](https://mariadb.com/kb/en/histogram-based-statistics/)

### When to Run ANALYZE TABLE

Run ANALYZE TABLE when:
- **Tables newly populated** with data
- **Significant data distribution changes** (e.g., table doubled in size)
- **New columns added** that appear in WHERE clauses
- **Query performance degrades** due to outdated statistics
- **Optimizer chooses wrong indexes** (check with EXPLAIN)

**Source:** [MariaDB ANALYZE TABLE Documentation](https://mariadb.com/kb/en/analyze-table/)

### Performance Considerations

**Impact:**
- Requires full table scan (for histograms)
- Can use significant disk I/O
- **Non-blocking** in current MariaDB versions (allows concurrent reads/writes)

**Best practice:**
- Run during low-traffic periods for large tables
- Collect statistics selectively (specific columns/indexes)
- Don't collect for all tables/columns unnecessarily

**Source:** [MariaDB ANALYZE TABLE Documentation](https://mariadb.com/kb/en/analyze-table/)

### Monitoring Statistics Usage

```sql
-- Check if engine-independent stats are used
SHOW VARIABLES LIKE 'use_stat_tables';
-- preferably_for_queries (default): Use if available
-- complementary: Use with engine stats
-- preferably: Prefer over engine stats
-- never: Don't use

-- View collected statistics
SELECT * FROM mysql.column_stats WHERE table_name = 'orders';
SELECT * FROM mysql.index_stats WHERE table_name = 'orders';
SELECT * FROM mysql.table_stats WHERE table_name = 'orders';
```

**Source:** [MariaDB Engine-Independent Statistics](https://mariadb.com/kb/en/engine-independent-table-statistics/)

### Example Workflow

```sql
-- 1. Check current query plan
EXPLAIN SELECT * FROM orders WHERE status = 'pending';

-- 2. Run basic ANALYZE
ANALYZE TABLE orders;

-- 3. For better selectivity estimation, collect histogram
SET histogram_size = 254;
ANALYZE TABLE orders PERSISTENT FOR COLUMNS(status);

-- 4. Re-check query plan
EXPLAIN SELECT * FROM orders WHERE status = 'pending';

-- 5. Monitor statistics usage
SHOW STATUS LIKE 'Handler%';
```

---

## Query Cache

**Note:** Query cache is **disabled by default** since MariaDB 10.1.7 due to scalability issues on multi-core systems.

**Source:** [MariaDB Query Cache Documentation](https://mariadb.com/kb/en/query-cache/)

### What Query Cache Does

Stores complete SELECT query results so identical queries return cached results instantly.

**Best for:**
- High-read, low-write environments (e.g., content websites)
- Identical queries repeated frequently
- Relatively static data

**Poor for:**
- High-write workloads (cache invalidated frequently)
- High throughput on multi-core machines (lock contention)
- Queries with non-deterministic functions (NOW(), RAND())

**Source:** [MariaDB Query Cache Documentation](https://mariadb.com/kb/en/query-cache/)

### Query Cache Configuration

#### Enable/Disable

```sql
-- Check status
SHOW VARIABLES LIKE 'query_cache_type';

-- Enable (session)
SET SESSION query_cache_type = ON;  -- or 1

-- Enable (global, affects new connections)
SET GLOBAL query_cache_type = ON;

-- Disable
SET GLOBAL query_cache_type = OFF;  -- or 0

-- Demand mode (only cache queries with SQL_CACHE hint)
SET GLOBAL query_cache_type = DEMAND;  -- or 2
```

**Source:** [MariaDB Query Cache Documentation](https://mariadb.com/kb/en/query-cache/)

**Values:**
- `0` or `OFF`: Disabled
- `1` or `ON`: All cacheable queries cached (default when enabled)
- `2` or `DEMAND`: Only queries with SQL_CACHE hint cached

**Automatic enablement:** If `query_cache_size` set to non-zero (non-default) value at startup, `query_cache_type` automatically set to ON.

**Source:** [MariaDB Query Cache Documentation](https://mariadb.com/kb/en/query-cache/)

#### Size Configuration

```sql
-- Set cache size (default: 1MB)
SET GLOBAL query_cache_size = 67108864;  -- 64MB

-- Limit per-query result size (prevent large results monopolizing cache)
SET GLOBAL query_cache_limit = 2097152;  -- 2MB
```

**Sizing guidance:**
- **About 40KB** needed for query cache structures
- Values should be multiples of 1024 for optimal performance
- Too small: Results dropped prematurely
- Too large: Lock contention reduces performance

**Source:** [MariaDB Query Cache Documentation](https://mariadb.com/kb/en/query-cache/)

### Monitoring Query Cache

```sql
SHOW STATUS LIKE 'Qcache%';

-- Key metrics:
-- Qcache_hits: Queries served from cache
-- Qcache_inserts: Queries added to cache
-- Qcache_lowmem_prunes: Queries dropped due to insufficient memory
-- Qcache_not_cached: Queries not cacheable

-- Calculate hit rate
-- hit_rate = Qcache_hits / Qcache_inserts
-- If hit_rate > 5, query cache may be beneficial
```

**Source:** [MariaDB Query Cache Documentation](https://mariadb.com/kb/en/query-cache/)

**Good indicators:**
- High `Qcache_hits` relative to `Qcache_inserts`
- Low `Qcache_lowmem_prunes`

**Bad indicators:**
- High `Qcache_lowmem_prunes` (increase size or reduce `query_cache_limit`)
- Low hit rate (< 5) (consider disabling)

### Query Cache in MySQL 8.0+

**MySQL 8.0 removed query cache entirely** due to scalability issues.

**MariaDB still supports it** but disabled by default for same reasons.

**Modern alternatives:**
- Application-level caching (Redis, Memcached)
- ProxySQL query cache
- MariaDB MaxScale cache filter

**Source:** [MariaDB Query Cache Documentation](https://mariadb.com/kb/en/query-cache/)

### Using Query Cache with SQL Hints

```sql
-- Force cache usage (when query_cache_type = DEMAND)
SELECT SQL_CACHE id, name FROM users WHERE status = 'active';

-- Prevent cache usage (when query_cache_type = ON)
SELECT SQL_NO_CACHE id, name FROM users WHERE status = 'active';
```

### When Query Cache is NOT Used

Cache bypassed for queries with:
- Non-deterministic functions: `NOW()`, `CURDATE()`, `RAND()`, `UUID()`
- User-defined functions
- Stored procedures
- Temporary tables
- System tables
- Queries inside transactions with uncommitted changes

**Source:** [MariaDB Query Cache Documentation](https://mariadb.com/kb/en/query-cache/)

---

## Summary and Best Practices

### EXPLAIN Analysis Checklist

1. **Check `type` column**: Aim for `const`, `eq_ref`, `ref`. Avoid `ALL`.
2. **Verify index usage**: `key` should not be NULL for large tables.
3. **Watch `rows` estimate**: Multiply across tables for total cost.
4. **Check `Extra` column**:
   - ✅ Good: `Using index`, `Using index condition`
   - ⚠️ Warning: `Using filesort`, `Using temporary`
   - ❌ Bad: `Range checked for each record`
5. **Use EXPLAIN ANALYZE** (MariaDB) to compare estimates vs actuals.

### Query Optimization Workflow

1. **Run EXPLAIN** on slow query
2. **Identify bottlenecks**: Full table scans, missing indexes, poor join order
3. **Check statistics**: Run `ANALYZE TABLE` if estimates are way off
4. **Add/modify indexes** as needed
5. **Rewrite query** if necessary (avoid anti-patterns)
6. **Re-run EXPLAIN** to verify improvements
7. **Test with real data** and monitor performance

### Index Strategy

1. **Create indexes on WHERE/JOIN columns**
2. **Consider covering indexes** for frequently-run queries
3. **Use composite indexes** properly (order matters!)
4. **Avoid over-indexing** (slows writes, wastes space)
5. **Match data types and collations** across joined columns

### Subquery Strategy

1. **Let MariaDB optimize automatically** (don't manually rewrite unless needed)
2. **Use EXPLAIN** to verify optimization strategy
3. **Monitor subquery cache** hit rate for correlated subqueries
4. **Rewrite as JOIN** only if optimizer can't optimize

### Advanced Optimization Checklist

- ✅ Enable ICP (default ON)
- ⚠️ Enable MRR for IO-bound queries on HDDs (`mrr=on`)
- ✅ Use appropriate `join_cache_level` (2 for default, 6-8 for large queries)
- ✅ Collect histograms for non-indexed filter columns
- ⚠️ Consider query cache only for read-heavy, static data workloads
- ✅ Run ANALYZE TABLE after significant data changes

### Performance Monitoring

```sql
-- Check query execution
EXPLAIN ANALYZE SELECT ...;

-- Monitor handler statistics
SHOW STATUS LIKE 'Handler%';

-- Check index usage
SHOW STATUS LIKE 'Handler_read%';

-- Monitor subquery cache
SHOW STATUS LIKE 'Subquery_cache%';

-- Check ICP effectiveness
SHOW STATUS LIKE 'Handler_icp%';

-- Check MRR usage
SHOW STATUS LIKE 'Handler_mrr%';
```

---

## Additional Resources

### Official Documentation

- [MariaDB Query Optimizations](https://mariadb.com/kb/en/query-optimizations/)
- [MariaDB EXPLAIN](https://mariadb.com/kb/en/explain/)
- [MariaDB EXPLAIN ANALYZE](https://mariadb.com/kb/en/explain-analyze/)
- [MariaDB optimizer_switch](https://mariadb.com/kb/en/optimizer-switch/)
- [MariaDB Subquery Optimizations](https://mariadb.com/kb/en/subquery-optimizations/)
- [MariaDB Index Condition Pushdown](https://mariadb.com/kb/en/index-condition-pushdown/)
- [MariaDB Multi-Range Read Optimization](https://mariadb.com/kb/en/multi-range-read-optimization/)
- [MariaDB Histogram-Based Statistics](https://mariadb.com/kb/en/histogram-based-statistics/)
- [MySQL EXPLAIN Output Format](https://dev.mysql.com/doc/refman/8.4/en/explain-output.html)
- [MySQL SELECT Optimization](https://dev.mysql.com/doc/refman/8.4/en/select-optimization.html)
- [MySQL Index Condition Pushdown](https://dev.mysql.com/doc/refman/8.4/en/index-condition-pushdown-optimization.html)

---

**Document Version:** 1.0  
**Last Updated:** 2026-02-17  
**Sources:** Official MariaDB and MySQL documentation (mariadb.com/kb/, dev.mysql.com/doc/)
