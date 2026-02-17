# MariaDB Hidden Gotchas and Pitfalls — Critical Reference

This is the **most critical** reference file in the MariaDB best practices skill. Every recommendation here is backed by official MariaDB and MySQL documentation.

## Table of Contents

1. [Collation Mismatches Making Indexes Unusable on JOINs](#1-collation-mismatches-making-indexes-unusable-on-joins)
2. [Implicit Type Conversions Bypassing Indexes](#2-implicit-type-conversions-in-where-clauses-bypassing-indexes)
3. [UTF8 vs UTF8MB4](#3-utf8-vs-utf8mb4--utf8-is-actually-utf8mb3)
4. [InnoDB Row Format and Index Key Length](#4-innodb-row-format-impacts-on-maximum-index-key-length)
5. [Temporal Type Precision Loss](#5-temporal-type-precision-loss-and-timezone-handling)
6. [ORDER BY with LIMIT Optimizer Traps](#6-order-by-with-limit-optimizer-traps)
7. [Subquery Materialization vs Semi-Join](#7-subquery-materialization-vs-semi-join-differences)
8. [Silent Data Truncation](#8-silent-data-truncation-on-insert-with-strict-mode-off)
9. [Character Set Coercion Rules](#9-character-set-coercion-rules-in-expressions)
10. [GROUP BY Implicit Sorting](#10-group-by-implicit-sorting)
11. [NULL Handling in Indexes and Unique Constraints](#11-null-handling-in-indexes-and-unique-constraints)
12. [AUTO_INCREMENT Gaps After Rollback](#12-auto_increment-gaps-after-rollback)
13. [Large Transaction Rollback Performance](#13-large-transaction-rollback-performance)
14. [Additional Critical Gotchas](#14-additional-critical-gotchas)

---

## 1. Collation Mismatches Making Indexes Unusable on JOINs

### The Problem

When joining tables on columns with different collations (even within the same character set), MariaDB cannot use indexes efficiently, forcing full table scans or filesorts.

```sql
-- Table A has column with utf8mb4_general_ci
-- Table B has column with utf8mb4_unicode_ci
-- JOIN on these columns will NOT use indexes
```

From the [MariaDB Knowledge Base on index usage](https://mariadb.com/kb/en/notes-when-an-index-cannot-be-used/):

> "A frequent mistake developers make is comparing indexed columns with columns that are not compatible, such as using incompatible character sets or collations."

From [MySQL 8.0 Reference Manual on index usage](https://dev.mysql.com/doc/refman/8.0/en/mysql-indexes.html):

> "For comparisons between nonbinary string columns, both columns should use the same character set."

### Collation Performance Differences

From [MySQL Unicode Character Sets documentation](https://dev.mysql.com/doc/refman/8.4/en/charset-unicode-sets.html):

- `utf8mb4_general_ci` — faster but less correct, legacy collation, no expansions/contractions
- `utf8mb4_unicode_ci` — supports expansions (e.g., `ss` = `ss` in German), contractions, ignorable characters

[MariaDB community reports](https://mariadb.com/kb/en/the-community-poor-performance-with-mariadb-11-and-utf8mb4_unicode_ci-vs-ut/) show switching collations caused query times to degrade from 3s to 8s+ due to lost index usage.

**Sources:**
- [Notes When an Index Cannot Be Used — MariaDB](https://mariadb.com/kb/en/notes-when-an-index-cannot-be-used/)
- [MySQL 8.0 How MySQL Uses Indexes](https://dev.mysql.com/doc/refman/8.0/en/mysql-indexes.html)
- [MySQL 8.4 Unicode Character Sets](https://dev.mysql.com/doc/refman/8.4/en/charset-unicode-sets.html)

---

## 2. Implicit Type Conversions in WHERE Clauses Bypassing Indexes

### The Problem

Comparing indexed VARCHAR columns with numeric values forces implicit type conversion, preventing index usage.

```sql
-- This WILL use the index
SELECT * FROM users WHERE email_id = '123';

-- This will NOT use the index (full table scan)
SELECT * FROM users WHERE email_id = 123;
```

From [MariaDB Type Conversion documentation](https://mariadb.com/kb/en/type-conversion/):

> "If a string column is being compared with a numeric value, MariaDB will not use the index on the column, as there are numerous alternatives that may evaluate as equal."

From [MySQL 8.4 Type Conversion documentation](https://dev.mysql.com/doc/refman/8.4/en/type-conversion.html):

> "The reason for this is that there are many different strings that may convert to the value 1, such as '1', ' 1', or '1a'."

### Solution

> "It is best practice not to rely upon implicit conversion; rather use CAST to explicitly convert types."

**Sources:**
- [MariaDB Type Conversion](https://mariadb.com/kb/en/type-conversion/)
- [MySQL 8.4 Type Conversion in Expression Evaluation](https://dev.mysql.com/doc/refman/8.4/en/type-conversion.html)

---

## 3. UTF8 vs UTF8MB4 — UTF8 is Actually UTF8MB3

### The Critical Issue

**In MariaDB, `utf8` is NOT full UTF-8. It's an alias for `utf8mb3`, which only supports 1-3 byte characters and silently truncates 4-byte characters** (emoji, some CJK, mathematical symbols).

From [MariaDB Unicode documentation](https://mariadb.com/kb/en/unicode/):

> "utf8 is an alias for utf8mb3"

From [MySQL 8.4 utf8mb3 Character Set](https://dev.mysql.com/doc/refman/8.4/en/charset-unicode-utf8mb3.html):

> "utf8mb3 supports only characters in the Basic Multilingual Plane (BMP). For a supplementary character, utf8mb4 requires four bytes to store it, whereas utf8mb3 cannot store the character at all."
>
> "**utf8mb3 is deprecated and you should expect it to be removed in a future MySQL release.**"

### Index Prefix Length Constraints

From [MariaDB Building the best INDEX](https://mariadb.com/kb/en/building-the-best-index-for-a-given-select/):

> "VARCHAR(255) can be a problem in 5.6 with utf8mb4"

With utf8mb4 (4 bytes/char) and COMPACT row format (767-byte limit), you can only index up to **VARCHAR(191)** instead of VARCHAR(255).

**Sources:**
- [MariaDB Unicode](https://mariadb.com/kb/en/unicode/)
- [MySQL 8.4 The utf8mb3 Character Set](https://dev.mysql.com/doc/refman/8.4/en/charset-unicode-utf8mb3.html)
- [MySQL 8.4 Converting Between 3-Byte and 4-Byte Character Sets](https://dev.mysql.com/doc/refman/8.4/en/charset-unicode-conversion.html)

---

## 4. InnoDB Row Format Impacts on Maximum Index Key Length

### Index Key Length Limits

| Row Format | Max Index Prefix |
|-----------|-----------------|
| COMPACT | 767 bytes |
| DYNAMIC (innodb_large_prefix=ON) | 3072 bytes |

From [MariaDB InnoDB COMPACT Row Format](https://mariadb.com/kb/en/innodb-compact-row-format/):

> "Limits indexing column values to 767 bytes"

From [MariaDB InnoDB DYNAMIC Row Format](https://mariadb.com/kb/en/innodb-dynamic-row-format/):

> "If innodb_large_prefix is set to ON, then the maximum prefix length is 3072 bytes"

### Practical Impact with utf8mb4

- **COMPACT**: Max indexed VARCHAR = 767 / 4 = **191 characters**
- **DYNAMIC**: Max indexed VARCHAR = 3072 / 4 = **768 characters**

### Overflow Page Differences

- **COMPACT**: First 767 bytes stored on main page + 20-byte pointer to overflow
- **DYNAMIC**: Only 20-byte pointer on main page, entire value on overflow pages

**Sources:**
- [MariaDB InnoDB COMPACT Row Format](https://mariadb.com/kb/en/innodb-compact-row-format/)
- [MariaDB InnoDB DYNAMIC Row Format](https://mariadb.com/kb/en/innodb-dynamic-row-format/)
- [MariaDB InnoDB Row Formats Overview](https://mariadb.com/kb/en/innodb-row-formats-overview/)

---

## 5. Temporal Type Precision Loss and Timezone Handling

### Fractional Seconds Precision

From [MariaDB Microseconds documentation](https://mariadb.com/kb/en/microseconds-in-mariadb/):

> "**If no precision is specified it is assumed to be 0, for backward compatibility reasons.** This means that by default, fractional seconds are not stored."
>
> "When you convert a temporal value to a value with a smaller precision, it will be **truncated, not rounded**."

```sql
-- LOSES fractional seconds
CREATE TABLE events (created DATETIME);

-- PRESERVES fractional seconds
CREATE TABLE events (created DATETIME(6));
```

### DATETIME vs TIMESTAMP

| | DATETIME | TIMESTAMP |
|--|----------|-----------|
| Storage | As-is, timezone-naive | UTC internally, converted on retrieval |
| Range | 1000-01-01 to 9999-12-31 | 1970-01-01 to 2038-01-19 |
| DST handling | No conversion issues | Can lose data around DST changes |

From [MariaDB Time Zones](https://mariadb.com/kb/en/time-zones/):

> "LOCALTIMESTAMP returns a DATETIME value, and storing its result in a TIMESTAMP column can result in data loss around DST changes."

**Sources:**
- [MariaDB Microseconds in MariaDB](https://mariadb.com/kb/en/microseconds-in-mariadb/)
- [MariaDB TIMESTAMP](https://mariadb.com/kb/en/timestamp/)
- [MariaDB DATETIME](https://mariadb.com/kb/en/datetime/)
- [MariaDB Time Zones](https://mariadb.com/kb/en/time-zones/)

---

## 6. ORDER BY with LIMIT Optimizer Traps

### The Problem

When ORDER BY uses non-indexed columns with LIMIT, MariaDB may:
1. Choose an expensive filesort operation
2. Process more rows than necessary before applying LIMIT
3. Use strategies not visible in EXPLAIN

From [MariaDB Filesort with Small LIMIT Optimization](https://mariadb.com/kb/en/filesort-with-small-limit-optimization/):

> "MariaDB uses a priority queue optimization for filesort operations with small LIMIT clauses."
>
> "EXPLAIN queries won't show whether filesort uses priority queue or the generic quicksort and merge algorithm."

From [MariaDB Improvements to ORDER BY](https://mariadb.com/kb/en/improvements-to-order-by/):

> "MariaDB always uses 'range' scans (not full 'index' scan) when it switches to an index to satisfy ORDER BY ... LIMIT."

**Sources:**
- [MariaDB Filesort with Small LIMIT Optimization](https://mariadb.com/kb/en/filesort-with-small-limit-optimization/)
- [MariaDB Improvements to ORDER BY Optimization](https://mariadb.com/kb/en/improvements-to-order-by/)

---

## 7. Subquery Materialization vs Semi-Join Differences

### Semi-Join Strategies

From [MariaDB Semi-join Subquery Optimizations](https://mariadb.com/kb/en/semi-join-subquery-optimizations/):

MariaDB has five semi-join execution strategies:
1. Table pullout
2. FirstMatch
3. Semi-join Materialization
4. LooseScan
5. DuplicateWeedout

### Materialization Details

From [MariaDB Semi-join Materialization Strategy](https://mariadb.com/kb/en/semi-join-materialization-strategy/):

> "The basic idea is to execute the subquery and store its result in an internal temporary table indexed on all its columns, which is only possible when the subquery is non-correlated."
>
> "If the size of the temporary table is less than tmp_table_size, it's a hash-indexed in-memory HEAP table. In rare cases when the result exceeds this limit, it's stored on disk."

Controlled by `optimizer_switch`: both `materialization=on` and `semijoin=on` must be set.

**Sources:**
- [MariaDB Semi-join Subquery Optimizations](https://mariadb.com/kb/en/semi-join-subquery-optimizations/)
- [MariaDB Semi-join Materialization Strategy](https://mariadb.com/kb/en/semi-join-materialization-strategy/)
- [MariaDB Non-semi-join Subquery Optimizations](https://mariadb.com/kb/en/non-semi-join-subquery-optimizations/)

---

## 8. Silent Data Truncation on INSERT with Strict Mode Off

### The Problem

From [MariaDB SQL_MODE documentation](https://mariadb.com/kb/en/sql-mode/):

> "With strict mode not set (default in version <= MariaDB 10.2.3), MariaDB will automatically adjust invalid values, for example, truncating strings that are too long, or adjusting numeric values that are out of range, and produce a warning."

Without strict mode, inserting `('MariaDB', '128')` into CHAR(5) and TINYINT columns:
- String silently truncated to `'Maria'`
- Number silently adjusted to `127` (TINYINT max)

With `STRICT_TRANS_TABLES`:
- INSERT fails with an error — no data corruption

**Sources:**
- [MariaDB SQL_MODE](https://mariadb.com/kb/en/sql-mode/)
- [MariaDB InnoDB Strict Mode](https://mariadb.com/kb/en/innodb-strict-mode/)

---

## 9. Character Set Coercion Rules in Expressions

### Coercibility Levels

From [MariaDB COERCIBILITY documentation](https://mariadb.com/kb/en/coercibility):

> "Coercibility defines what will be converted to what in case of collation conflict, with an expression with higher coercibility being converted to the collation of an expression with lower coercibility."

Character sets and collations cascade from server → database → table → column level. Mismatches at any level can cause `Error 1271: Illegal mix of collations`.

**Solution:** Use the `COLLATE` clause to standardize collations in operations.

**Sources:**
- [MariaDB COERCIBILITY](https://mariadb.com/kb/en/coercibility)
- [MariaDB Character Set and Collation Overview](https://mariadb.com/kb/en/character-set-and-collation-overview/)
- [MariaDB Error 1271](https://mariadb.com/kb/en/e1271/)

---

## 10. GROUP BY Implicit Sorting

### MariaDB Still Sorts GROUP BY Results

From [MariaDB GROUP BY documentation](https://mariadb.com/kb/en/group-by/):

> "By default, if a GROUP BY clause is present, the rows in the output will be sorted by the expressions used in the GROUP BY."
>
> "If you don't want the result to be ordered, you can add ORDER BY NULL."

**Critical difference from MySQL 8.0+:** MySQL removed implicit GROUP BY sorting, but MariaDB still performs it. If you don't need sorted results, always add `ORDER BY NULL` to avoid overhead.

### ONLY_FULL_GROUP_BY

MariaDB allows SELECTing non-aggregated columns not in GROUP BY (unless `ONLY_FULL_GROUP_BY` is enabled). This differs from MySQL 8.0+ where it's enabled by default.

**Sources:**
- [MariaDB GROUP BY](https://mariadb.com/kb/en/group-by/)
- [MariaDB SQL_MODE](https://mariadb.com/kb/en/sql-mode/)

---

## 11. NULL Handling in Indexes and Unique Constraints

### NULL in Unique Constraints

From [MariaDB NULL Values documentation](https://mariadb.com/kb/en/null-values/):

> "A UNIQUE constraint allows multiple NULL values because in SQL, NULL is never equal to another NULL."

From [MariaDB Getting Started with Indexes](https://mariadb.com/kb/en/getting-started-with-indexes/):

> "Unlike primary keys, columns in a unique index can store NULL values."

### NULL Comparisons

> "NULL values cannot be used with most comparison operators. =, >, >=, <=, <, or != cannot be used, as any comparison with a NULL always returns a NULL value, never true or false."

Use `IS NULL` / `IS NOT NULL` instead.

**Sources:**
- [MariaDB NULL Values](https://mariadb.com/kb/en/null-values/)
- [MariaDB Getting Started with Indexes](https://mariadb.com/kb/en/getting-started-with-indexes/)

---

## 12. AUTO_INCREMENT Gaps After Rollback

### The Problem

AUTO_INCREMENT values are **NOT transactional**. Once allocated, they are never reused.

From [MariaDB AUTO_INCREMENT Handling in InnoDB](https://mariadb.com/kb/en/auto_increment-handling-in-innodb/):

> "While persistent, it does not mean transactional. When a transaction is rolled back, the AUTO_INCREMENT value that was allocated to that transaction is not recovered and reused — it creates a gap in the sequence."

Gaps also occur from: `INSERT IGNORE` failures, `ROLLBACK`, `ROLLBACK TO SAVEPOINT`, deleted rows.

**Never rely on AUTO_INCREMENT values being sequential or gap-free.** They guarantee uniqueness and increasing order, not continuity.

**Sources:**
- [MariaDB AUTO_INCREMENT Handling in InnoDB](https://mariadb.com/kb/en/auto_increment-handling-in-innodb/)
- [MariaDB AUTO_INCREMENT](https://mariadb.com/kb/en/auto_increment/)

---

## 13. Large Transaction Rollback Performance

### Undo Log Impact

From [MariaDB InnoDB Undo Log documentation](https://mariadb.com/kb/en/innodb-undo-log/):

> "Long transactions generate several old versions of the rows in the undo log. A sort of combinatorial explosion can be observed."
>
> "ROLLBACK never makes use of the change buffer; it would force a merge of any changes that were buffered during the execution of the transaction."

Performance degradation from large transactions is caused by:
1. Undo log management overhead
2. Multiple row versions in memory
3. Forced merge of change buffer on rollback
4. Concurrent transaction contention for undo log space

From [MariaDB InnoDB Limitations](https://mariadb.com/kb/en/innodb-limitations/):

> "You can modify data on a maximum of 96 * 1023 concurrent transactions that generate undo records."

**Sources:**
- [MariaDB InnoDB Undo Log](https://mariadb.com/kb/en/innodb-undo-log/)
- [MariaDB InnoDB Limitations](https://mariadb.com/kb/en/innodb-limitations/)

---

## 14. Additional Critical Gotchas

### 14.1 DDL Statements Cause Implicit Commit

From [MariaDB SQL statements Causing an Implicit Commit](https://mariadb.com/kb/en/sql-statements-that-cause-an-implicit-commit/):

> "TRUNCATE TABLE causes an implicit commit even when used on a temporary table."

A TRUNCATE inside a transaction will commit everything before it, preventing rollback of prior statements.

### 14.2 Foreign Key CASCADE Not Logged to Binary Log

From [MariaDB Replication and Foreign Keys](https://mariadb.com/kb/en/replication-and-foreign-keys/):

> "Cascading deletes or updates based on foreign key relations are an internal mechanism, and are not written to the binary log."

From [MariaDB TRUNCATE TABLE](https://mariadb.com/kb/en/truncate-table/):

> "A TRUNCATE TABLE statement against a table containing one or more foreign keys is executed as a DELETE without a WHERE clause."

TRUNCATE on tables with foreign keys runs as row-by-row DELETE, losing its performance advantage.

### 14.3 Transaction Isolation: REPEATABLE READ vs READ COMMITTED

From [MariaDB READ COMMITTED documentation](https://mariadb.com/kb/en/transactions-read-committed/):

> "If the READ COMMITTED isolation level is used, there is no InnoDB gap locking except for foreign-key constraint checking and duplicate-key checking."

This can prevent phantom reads vs deadlocks trade-off.

### 14.4 Deadlock Detection

From [MariaDB InnoDB System Variables](https://mariadb.com/kb/en/innodb-system-variables/):

> "If deadlock detection is disabled, locked transactions will wait until they exceed innodb_lock_wait_timeout. Therefore it is important to set innodb_lock_wait_timeout to a very low value, like 1."

InnoDB kills the transaction that modified the least data when a deadlock is detected.

---

## Quick Reference Summary

| Gotcha | Impact | Prevention |
|--------|--------|------------|
| Collation mismatch on JOINs | Index bypassed, full table scan | Use identical collations on joined columns |
| Implicit type conversion | Index bypassed, full table scan | Use CAST() or match types in comparisons |
| utf8 = utf8mb3 | 4-byte characters truncated | Always use utf8mb4 |
| COMPACT row format | Max index prefix 767 bytes | Use DYNAMIC row format |
| DATETIME without precision | Fractional seconds lost | Specify DATETIME(6) |
| TIMESTAMP timezone | Values converted to UTC | Use DATETIME for timezone-naive storage |
| ORDER BY non-indexed + LIMIT | Filesort on large datasets | Add covering index |
| No strict mode | Silent data truncation | Enable STRICT_TRANS_TABLES |
| GROUP BY implicit sort | Unnecessary sorting | Add ORDER BY NULL |
| NULL in UNIQUE index | Multiple NULLs allowed | Use NOT NULL or composite constraints |
| AUTO_INCREMENT + ROLLBACK | Gaps in sequence | Never rely on sequential IDs |
| Large transaction rollback | Severe performance degradation | Use smaller transactions, batch operations |
| TRUNCATE TABLE | Implicit commit | Use DELETE in transactions |
| FK CASCADE | Not in binary log | Be cautious with replication |

---

*Document compiled from official MariaDB Knowledge Base (mariadb.com/kb/) and MySQL Reference Manual (dev.mysql.com/doc/) — February 2026*
