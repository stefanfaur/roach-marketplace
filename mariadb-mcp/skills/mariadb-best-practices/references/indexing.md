# MariaDB Indexing Best Practices Reference

Comprehensive reference for MariaDB indexing covering B-tree internals, composite index design, covering indexes, EXPLAIN analysis, ICP, MRR, and index size limits.

## Table of Contents

1. [B-tree Index Internals](#b-tree-index-internals)
2. [Composite Index Column Ordering](#composite-index-column-ordering)
3. [Covering Indexes](#covering-indexes)
4. [Prefix Indexes](#prefix-indexes)
5. [Fulltext Indexes](#fulltext-indexes)
6. [Spatial Indexes](#spatial-indexes)
7. [Unique vs Non-Unique Indexes](#unique-vs-non-unique-indexes)
8. [Duplicate and Redundant Index Detection](#duplicate-and-redundant-index-detection)
9. [Index Size Limits by InnoDB Row Format](#index-size-limits-by-innodb-row-format)
10. [Reading EXPLAIN Output](#reading-explain-output)
11. [Index Condition Pushdown (ICP)](#index-condition-pushdown-icp)
12. [Multi-Range Read (MRR)](#multi-range-read-mrr)

---

## B-tree Index Internals

### Physical Structure

InnoDB indexes (except spatial) use **B-tree data structures**. Leaf pages contain actual index records, non-leaf pages contain branch information. Default page size is **16KB** (configurable via `innodb_page_size`). Records are stored in sorted order.

Source: [MySQL 8.0 — Physical Structure of an InnoDB Index](https://dev.mysql.com/doc/refman/8.0/en/innodb-physical-structure.html)

### How B-trees Serve Range Queries

B-trees enable efficient range scans by starting at one key value and repeatedly finding the next/previous row:

```sql
WHERE col = value          -- Equality
WHERE col > value          -- Range
WHERE col BETWEEN a AND b  -- Range
WHERE col LIKE 'prefix%'   -- Prefix matching (no leading wildcard)
WHERE col IS NOT NULL       -- NULL checks
```

Sources:
- [MariaDB — Building the Best Index](https://mariadb.com/kb/en/building-the-best-index-for-a-given-select/)
- [MySQL 8.0 — Comparison of B-Tree and Hash Indexes](https://dev.mysql.com/doc/refman/8.0/en/index-btree-hash.html)

### Page Fill Factors

- **Sequential insertions**: Pages ~15/16 full (1/16 reserved for updates)
- **Random insertions**: Pages 1/2 to 15/16 full
- When fill factor drops below `MERGE_THRESHOLD` (default 50%), InnoDB merges pages

Source: [MySQL 8.0 — Physical Structure](https://dev.mysql.com/doc/refman/8.0/en/innodb-physical-structure.html)

### Clustered vs Secondary Indexes

In InnoDB, data and PRIMARY KEY are clustered in one B-tree. Secondary indexes contain primary key values as pointers. This means:
- Primary key lookups are fastest (single B-tree traversal)
- Secondary index lookups require two B-tree traversals (index + clustered)
- Shorter primary keys = smaller secondary indexes

Source: [MariaDB — Building the Best Index](https://mariadb.com/kb/en/building-the-best-index-for-a-given-select/)

---

## Composite Index Column Ordering

### The Leftmost Prefix Rule

An index on `(col1, col2, col3)` can serve queries filtering on:
- `col1` alone
- `col1, col2`
- `col1, col2, col3`

But **cannot** efficiently serve queries filtering only on `col2`, `col3`, or `col2, col3`.

Sources:
- [MariaDB — Compound (Composite) Indexes](https://mariadb.com/kb/en/compound-composite-indexes/)
- [MariaDB — Storage Engine Index Types](https://mariadb.com/kb/en/storage-engine-index-types/)

### Column Ordering Algorithm

1. **Equality conditions first**: Columns compared to constants in WHERE (connected by AND), in any order
2. **Add one of the following**:
   - A single range condition (`BETWEEN`, `>`, `<`, `LIKE` without leading wildcard)
   - All `GROUP BY` columns in specified order
   - All `ORDER BY` columns in order (if no ASC/DESC mixing)
3. **Stop**: Don't add more columns after step 2

**Important notes:**
- WHERE clause order doesn't matter; INDEX order does
- Only **one range condition** per index is useful
- Shuffling fields in an INDEX can make a huge difference

Source: [MariaDB — Building the Best Index](https://mariadb.com/kb/en/building-the-best-index-for-a-given-select/)

---

## Covering Indexes

### Definition

A "covering" index contains **all columns** referenced in SELECT, WHERE, ORDER BY, and GROUP BY. The query completes by reading only the index B-tree, without accessing the data table.

### How to Build

1. Build the index using the standard algorithm (equality -> range/GROUP BY/ORDER BY)
2. Append remaining SELECT columns in any order

```sql
SELECT x, y FROM t WHERE z = 5 ORDER BY w;
-- Optimal covering index: INDEX(z, w, x, y)
```

### Benefits

- **No data table access** (dramatic I/O reduction)
- EXPLAIN shows `"Using index"` in Extra column
- With `LIMIT`, only (OFFSET + LIMIT) rows gathered

### Limitations

- Maximum practical width: 5 columns
- Size limit: 3072 bytes
- Prefix indexes cannot participate in covering strategies

Sources:
- [MariaDB — Building the Best Index](https://mariadb.com/kb/en/building-the-best-index-for-a-given-select/)
- [MariaDB — Compound Indexes](https://mariadb.com/kb/en/compound-composite-indexes/)

---

## Prefix Indexes

### Overview

Index a specified number of leading characters from CHAR, VARCHAR, TEXT, or BLOB columns.

```sql
CREATE INDEX idx_name ON table_name(column_name(20));
```

TEXT and BLOB columns **require** a prefix length. For character columns, the prefix specifies **number of characters**, not bytes.

### Limitations

1. **Cannot participate in covering indexes** (index-only scans)
2. **Often low selectivity**: "Rarely useful" for distinguishing similar values
3. **Optimizer may ignore** if selectivity is too low
4. **Cannot use full column value** for sorting or grouping

### Size Limits

- **COMPACT**: 767 bytes maximum
- **DYNAMIC/COMPRESSED**: 3072 bytes maximum (16KB pages)

Sources:
- [MariaDB — Building the Best Index](https://mariadb.com/kb/en/building-the-best-index-for-a-given-select/)
- [MariaDB — VARCHAR Documentation](https://mariadb.com/kb/en/varchar/)
- [MySQL 8.0 — InnoDB Limits](https://dev.mysql.com/doc/refman/8.0/en/innodb-limits.html)

---

## Fulltext Indexes

### Overview

FULLTEXT indexes enable advanced text searching using `MATCH() ... AGAINST()`.

Supported engines: MyISAM, Aria, InnoDB (from MariaDB 10.0.5+), Mroonga.

Source: [MariaDB — Full-Text Index Overview](https://mariadb.com/kb/en/full-text-index-overview/)

### Creating Fulltext Indexes

```sql
CREATE TABLE articles (
    id INT PRIMARY KEY,
    title VARCHAR(200),
    body TEXT,
    FULLTEXT KEY ft_title_body (title, body)
);
```

### Search Modes

**Natural Language Mode** (default):
```sql
SELECT * FROM articles
WHERE MATCH(title, body) AGAINST ('database performance');
```

**Boolean Mode** (operators: `+` must exist, `-` must not, `*` wildcard, `" "` phrase):
```sql
SELECT * FROM articles
WHERE MATCH(title, body) AGAINST ('+database -deprecated' IN BOOLEAN MODE);
```

**Query Expansion Mode** (two-pass search):
```sql
SELECT * FROM articles
WHERE MATCH(title, body)
AGAINST ('database' IN NATURAL LANGUAGE MODE WITH QUERY EXPANSION);
```

### Configuration

- **Minimum word length**: MyISAM/Aria default 4 chars (`ft_min_word_len`), InnoDB default 3 chars (`innodb_ft_min_token_size`)
- **Maximum word length**: 84 characters
- **Stopwords**: Common words ignored in natural language mode. Configure via `ft_stopword_file`

Sources:
- [MariaDB — Full-Text Index Overview](https://mariadb.com/kb/en/full-text-index-overview/)
- [MariaDB — MATCH AGAINST](https://mariadb.com/kb/en/match-against/)
- [MariaDB — Full-Text Index Stopwords](https://mariadb.com/kb/en/full-text-index-stopwords/)

---

## Spatial Indexes

Use R-tree structure for geometric data in GIS applications.

```sql
CREATE TABLE locations (
    id INT PRIMARY KEY,
    coordinates GEOMETRY NOT NULL,
    SPATIAL INDEX idx_coords (coordinates)
);
```

**Requirements:** Columns must be declared `NOT NULL`.

Supported types: GEOMETRY, POINT, LINESTRING, POLYGON, MULTIPOINT, MULTILINESTRING, MULTIPOLYGON, GEOMETRYCOLLECTION.

Source: [MariaDB — SPATIAL INDEX](https://mariadb.com/kb/en/spatial-index/)

---

## Unique vs Non-Unique Indexes

### Unique Indexes

```sql
CREATE UNIQUE INDEX idx_email ON users(email);
```

- Ensures all values are unique
- **Allows multiple NULL values** (NULL != NULL in SQL)
- EXPLAIN shows `eq_ref` for unique index lookups

### Non-Unique Indexes

```sql
CREATE INDEX idx_last_name ON users(last_name);
```

- Allows duplicate values
- EXPLAIN shows `ref` for non-unique index lookups

**Warning with INSERT ON DUPLICATE KEY UPDATE**: With multiple unique indexes, if more than one matches, only the first is updated. Not recommended for tables with multiple unique indexes.

Sources:
- [MariaDB — CREATE INDEX](https://mariadb.com/kb/en/create-index/)
- [MariaDB — Getting Started with Indexes](https://mariadb.com/kb/en/getting-started-with-indexes/)
- [MariaDB — INSERT ON DUPLICATE KEY UPDATE](https://mariadb.com/kb/en/insert-on-duplicate-key-update/)

---

## Duplicate and Redundant Index Detection

### Redundant Index Rules

- `INDEX(a)` is redundant if `INDEX(a, b)` exists
- `INDEX(a, b)` is redundant if `INDEX(a, b, c)` exists
- `UNIQUE INDEX(a)` is NOT redundant even if `INDEX(a)` exists (different constraint)

### Finding Unused Indexes

```sql
-- Enable index statistics tracking
SET GLOBAL userstat = ON;

-- Find never-used indexes
SELECT TABLE_SCHEMA, TABLE_NAME, INDEX_NAME
FROM information_schema.INDEX_STATISTICS
WHERE ROWS_READ = 0
  AND TABLE_SCHEMA NOT IN ('mysql', 'information_schema', 'performance_schema');

-- View all index usage
SHOW INDEX_STATISTICS;
```

### Best Practices

1. Remove redundant indexes (keep only the most comprehensive)
2. Monitor index usage via INDEX_STATISTICS
3. Limit to ~6 indexes per table
4. Each INSERT/UPDATE must modify all indexes — overhead matters

Sources:
- [MariaDB — Building the Best Index](https://mariadb.com/kb/en/building-the-best-index-for-a-given-select/)
- [MariaDB — INDEX_STATISTICS Table](https://mariadb.com/kb/en/information-schema-index_statistics-table/)
- [MariaDB — SHOW INDEX](https://mariadb.com/kb/en/show-index/)

---

## Index Size Limits by InnoDB Row Format

| Row Format | Index Prefix (16KB pages) | Index Prefix (8KB) | Index Prefix (4KB) | INSTANT DDL |
|------------|--------------------------|--------------------|--------------------|-------------|
| REDUNDANT  | 767 bytes                | 767 bytes          | 767 bytes          | Yes         |
| COMPACT    | 767 bytes                | 767 bytes          | 767 bytes          | Yes         |
| DYNAMIC    | **3,072 bytes**          | 1,536 bytes        | 768 bytes          | Yes         |
| COMPRESSED | **3,072 bytes**          | 1,536 bytes        | 768 bytes          | No          |

**DYNAMIC is the recommended default** for most use cases.

```sql
SET GLOBAL innodb_default_row_format = 'DYNAMIC';
CREATE TABLE t1 (...) ROW_FORMAT=DYNAMIC;
```

Maximum row size: 65,535 bytes (excluding BLOB/TEXT content).

Sources:
- [MariaDB — InnoDB Row Formats Overview](https://mariadb.com/kb/en/innodb-row-formats-overview/)
- [MariaDB — InnoDB COMPACT Row Format](https://mariadb.com/kb/en/innodb-compact-row-format/)
- [MariaDB — InnoDB DYNAMIC Row Format](https://mariadb.com/kb/en/innodb-dynamic-row-format/)
- [MySQL 8.0 — InnoDB Limits](https://dev.mysql.com/doc/refman/8.0/en/innodb-limits.html)

---

## Reading EXPLAIN Output

### Key Columns

#### type (Access Method) — Best to Worst

| Type | Description | When |
|------|-------------|------|
| `const` | One matching row, read at optimization time | `WHERE pk = constant` |
| `eq_ref` | One row via unique index (best for joins) | `JOIN ON unique_key = value` |
| `ref` | Multiple rows via non-unique index | `WHERE indexed_col = constant` |
| `range` | Index over value ranges | `WHERE col BETWEEN a AND b` |
| `index` | Full index scan | Better than ALL but still slow |
| `ALL` | **Full table scan — no index used** | Worst case |

#### key

Which index the optimizer selected. `NULL` = no index used (full table scan).

#### key_len

Byte usage of selected index. Helps identify if optimizer uses full composite index or only prefix.

#### rows

Estimated rows to examine (not returned). Lower is better. Use `ANALYZE` for actual counts.

#### Extra — Critical Values

| Value | Meaning |
|-------|---------|
| `Using index` | Covering index — no table access needed (best) |
| `Using where` | Additional filtering beyond index lookup |
| `Using index condition` | Index Condition Pushdown active |
| `Using temporary` | Temporary table created |
| `Using filesort` | Separate disk sort operation |

### ANALYZE for Actual Statistics

```sql
ANALYZE SELECT * FROM users WHERE created_at > '2024-01-01';
```

Shows actual row counts, filtering percentages, and execution time.

Sources:
- [MariaDB — EXPLAIN](https://mariadb.com/kb/en/explain/)
- [MariaDB — ANALYZE Statement](https://mariadb.com/kb/en/analyze-statement/)

---

## Index Condition Pushdown (ICP)

### How It Works

**Without ICP**: Access index -> retrieve full record -> check WHERE conditions
**With ICP**: Access index -> **check conditions using index data** -> only retrieve if conditions pass

ICP is **enabled by default**. Shows as `"Using index condition"` in EXPLAIN Extra.

### Applicable Access Methods

`range`, `ref`, `eq_ref`, `ref_or_null`, Batched Key Access

### Monitoring

```sql
SHOW STATUS LIKE 'Handler_icp%';
-- Handler_icp_attempts: condition checks
-- Handler_icp_match: condition successes
-- Efficiency: (attempts - match) / attempts = % records avoided
```

### Limitations

- Virtual column indexes cannot use ICP (use STORED generated columns)
- Backward index scans (`ORDER BY ... DESC`) disable ICP
- Partitioned tables: support added in MariaDB 11.5

Source: [MariaDB — Index Condition Pushdown](https://mariadb.com/kb/en/index-condition-pushdown/)

---

## Multi-Range Read (MRR)

### How It Works

**Without MRR**: Index lookup -> retrieve rows in index order (random disk access)
**With MRR**: Index lookup -> **sort rowids by disk location** -> retrieve in disk order (sequential)

Each disk page is read **exactly once**, eliminating redundant reads.

### Three Strategies

1. **Rowid-Ordered Scan for Range Queries** — sorts row IDs from range scans
2. **Rowid-Ordered Scan for Joins** — eliminates duplicate index accesses
3. **Key-Ordered Scan for Joins** — sorts lookup keys to minimize redundant page accesses

### Configuration

```sql
SET optimizer_switch='mrr=on';
SET optimizer_switch='mrr_sort_keys=on';
SET SESSION mrr_buffer_size = 1048576;  -- 1MB
```

### Monitoring

```sql
SHOW STATUS LIKE 'Handler_mrr%';
-- Handler_mrr_key_refills: key buffer refills (non-zero = buffer too small)
-- Handler_mrr_rowid_refills: rowid buffer refills
```

### When to Use

**Good for**: Large range scans on disk-based tables, queries scanning significant portions
**Bad for**: Tables fitting in memory, `ORDER BY ... LIMIT n` with small n, SSDs with fast random I/O

Source: [MariaDB — Multi Range Read Optimization](https://mariadb.com/kb/en/multi-range-read-optimization/)

---

## Summary of Best Practices

### Index Design
1. Follow the systematic column ordering: equality -> range/GROUP BY/ORDER BY
2. Create covering indexes when possible (max 5 columns, 3KB limit)
3. Use DYNAMIC row format for maximum index prefix length (3072 bytes)
4. Limit to ~6 indexes per table

### Index Maintenance
1. Remove redundant indexes
2. Monitor usage via `INDEX_STATISTICS`
3. Run `ANALYZE TABLE` regularly for optimizer statistics
4. Use `SHOW INDEX` to review configuration

### Query Verification
1. Always check `EXPLAIN` before deploying queries
2. Look for `Using index` in Extra (covering index)
3. Avoid `type: ALL` (full table scan) in production
4. Enable ICP (default) for multi-column index filtering

---

## Sources

- [MariaDB — Building the Best Index for a Given SELECT](https://mariadb.com/kb/en/building-the-best-index-for-a-given-select/)
- [MariaDB — Compound (Composite) Indexes](https://mariadb.com/kb/en/compound-composite-indexes/)
- [MariaDB — Getting Started with Indexes](https://mariadb.com/kb/en/getting-started-with-indexes/)
- [MariaDB — Storage Engine Index Types](https://mariadb.com/kb/en/storage-engine-index-types/)
- [MariaDB — EXPLAIN](https://mariadb.com/kb/en/explain/)
- [MariaDB — Index Condition Pushdown](https://mariadb.com/kb/en/index-condition-pushdown/)
- [MariaDB — Multi Range Read Optimization](https://mariadb.com/kb/en/multi-range-read-optimization/)
- [MariaDB — Full-Text Index Overview](https://mariadb.com/kb/en/full-text-index-overview/)
- [MariaDB — SPATIAL INDEX](https://mariadb.com/kb/en/spatial-index/)
- [MariaDB — InnoDB Row Formats Overview](https://mariadb.com/kb/en/innodb-row-formats-overview/)
- [MariaDB — INDEX_STATISTICS Table](https://mariadb.com/kb/en/information-schema-index_statistics-table/)
- [MySQL 8.0 — Physical Structure of an InnoDB Index](https://dev.mysql.com/doc/refman/8.0/en/innodb-physical-structure.html)
- [MySQL 8.0 — InnoDB Limits](https://dev.mysql.com/doc/refman/8.0/en/innodb-limits.html)
- [MySQL 8.0 — Comparison of B-Tree and Hash Indexes](https://dev.mysql.com/doc/refman/8.0/en/index-btree-hash.html)

---

*Document compiled from official MariaDB Knowledge Base (mariadb.com/kb/) and MySQL Reference Manual (dev.mysql.com/doc/) — February 2026*
