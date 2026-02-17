# MariaDB Schema Design Best Practices

Comprehensive reference for designing optimal MariaDB schemas, covering data types, normalization, partitioning, character sets, collations, and storage engines.

**Sources**: This document synthesizes official MariaDB and MySQL documentation with inline URL citations.

---

## Table of Contents

1. [Data Type Selection](#data-type-selection)
2. [Normalization & Denormalization](#normalization--denormalization)
3. [Partitioning Strategies](#partitioning-strategies)
4. [Character Sets & Collations](#character-sets--collations)
5. [Storage Engine Selection](#storage-engine-selection)
6. [Primary Keys & Indexing](#primary-keys--indexing)

---

## Data Type Selection

### Core Principle: Use the Smallest Efficient Type

**Always choose the smallest data type that can hold all required values.** This minimizes storage usage, improves cache efficiency, and enhances query performance.

> "For optimum storage, you should try to use the most precise type in all cases. For example, if an integer column is used for values in the range from 1 to 99999, MEDIUMINT UNSIGNED is the best type."  
> — [MySQL 8.0 Reference Manual: Choosing the Right Type for a Column](https://dev.mysql.com/doc/refman/8.0/en/choosing-types.html)

### Integer Types

MariaDB offers five integer types sized by storage requirements:

| Type | Storage | Signed Range | Unsigned Range | Use Case |
|------|---------|--------------|----------------|----------|
| `TINYINT` | 1 byte | -128 to 127 | 0 to 255 | Ages, boolean flags, small counts |
| `SMALLINT` | 2 bytes | -32,768 to 32,767 | 0 to 65,535 | Moderate counts, year values |
| `MEDIUMINT` | 3 bytes (4 in memory) | -8,388,608 to 8,388,607 | 0 to 16,777,215 | Large counts, auto-increment IDs |
| `INT` / `INTEGER` | 4 bytes | -2,147,483,648 to 2,147,483,647 | 0 to 4,294,967,295 | Standard integer IDs, most counts |
| `BIGINT` | 8 bytes | -2^63 to 2^63-1 | 0 to 2^64-1 | Very large values, 64-bit timestamps |

**References**:
- [MariaDB Data Types](https://mariadb.com/kb/en/data-types/)
- [MariaDB Data Type Storage Requirements](https://mariadb.com/kb/en/data-type-storage-requirements/)

**Best Practices**:
- Use `UNSIGNED` for values that cannot be negative (counts, IDs)
- Prefer `INT UNSIGNED` for auto-increment primary keys (supports 4.2 billion values)
- Use `BIGINT` only when truly needed; the 8-byte size impacts index performance

### Precision Types: DECIMAL vs FLOAT vs DOUBLE

| Type | Storage | Precision | Use Case |
|------|---------|-----------|----------|
| `DECIMAL(M,D)` | Variable (1-9 digits = 4 bytes) | Exact, up to 65 digits | **Financial calculations, monetary amounts** |
| `FLOAT` | 4 bytes | Approximate (~7 digits) | Scientific data where small rounding is acceptable |
| `DOUBLE` | 8 bytes | Approximate (~15 digits) | High-precision scientific calculations |

**DECIMAL for Financial Data**:

DECIMAL stores exact fixed-point numbers, making it **mandatory for financial calculations** where rounding errors are unacceptable.

> "The DECIMAL type is a packed 'exact' fixed-point number where M is the total number of digits (the precision), and D is the number of digits after the decimal point (the scale)."  
> — [MariaDB DECIMAL Documentation](https://mariadb.com/kb/en/decimal/)

**Key specifications**:
- Maximum precision (M): 65 digits
- Maximum scale (D): 38 digits
- All basic calculations (`+`, `-`, `*`, `/`) use 65-digit precision
- Defaults: `DECIMAL` = `DECIMAL(10,0)`

**Example**:
```sql
CREATE TABLE transactions (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    amount DECIMAL(19,4) NOT NULL,  -- Supports up to 999,999,999,999,999.9999
    currency CHAR(3) NOT NULL
);
```

**FLOAT/DOUBLE for Performance-Critical Approximations**:

> "DECIMAL provides exact numeric data with a defined precision and scale. FLOAT and DOUBLE are approximate types with inherent rounding errors."  
> — [MariaDB Data Types](https://mariadb.com/kb/en/data-types/)

Use `FLOAT` or `DOUBLE` only when:
- Small rounding errors are acceptable
- Performance is critical
- Data is inherently approximate (sensor readings, scientific measurements)

**References**:
- [MariaDB DECIMAL](https://mariadb.com/kb/en/decimal/)
- [MySQL Choosing Types](https://dev.mysql.com/doc/refman/8.0/en/choosing-types.html)

### String Types: VARCHAR vs TEXT

| Type | Max Length | Storage | Indexing | Temporary Tables |
|------|-----------|---------|----------|------------------|
| `VARCHAR(M)` | 65,532 characters | `len + 1` or `len + 2` bytes | Fully indexable | Memory-based possible |
| `TEXT` | 65,535 bytes | `len + 2` bytes | Prefix only (max 767 bytes) | Forces disk-based |
| `MEDIUMTEXT` | 16 MB | `len + 3` bytes | Prefix only | Forces disk-based |
| `LONGTEXT` | 4 GB | `len + 4` bytes | Prefix only | Forces disk-based |

**VARCHAR Best Practices**:

> "VARCHAR columns allocate the full length inside each TABLE object's record structure. Each open table allocates 3 times the max-length-to-store-varchar bytes of memory."  
> — [MariaDB VARCHAR Documentation](https://mariadb.com/kb/en/varchar/)

**Key characteristics**:
- Trailing spaces are **not** removed (unlike in some databases)
- Can be fully indexed (unlike TEXT)
- Higher per-table memory overhead but lower per-row overhead

**When to use VARCHAR**:
- Columns under 255 characters (uses 1-byte length prefix)
- Frequently searched/indexed columns
- Columns used in JOINs or WHERE clauses

**When to use TEXT**:

> "Using TEXT or BLOB in a SELECT query that uses temporary tables for storing intermediate results will force the temporary table to be disk based."  
> — [MariaDB VARCHAR Documentation](https://mariadb.com/kb/en/varchar/)

Use TEXT types for:
- Large content (blog posts, descriptions)
- Columns rarely queried or indexed
- Content that varies widely in size

**Example**:
```sql
CREATE TABLE articles (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    title VARCHAR(255) NOT NULL,           -- Fully indexable, small memory footprint
    slug VARCHAR(255) NOT NULL UNIQUE,     -- Indexed for lookups
    summary VARCHAR(1000),                 -- Moderate-length preview
    content MEDIUMTEXT NOT NULL,           -- Large variable content
    INDEX idx_title (title(50))            -- Prefix index on title
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

**References**:
- [MariaDB VARCHAR](https://mariadb.com/kb/en/varchar/)
- [MariaDB TEXT](https://mariadb.com/kb/en/text/)
- [MariaDB Data Type Storage Requirements](https://mariadb.com/kb/en/data-type-storage-requirements/)

### Temporal Types with Precision

| Type | Storage | Range | Timezone-Aware | Microsecond Precision |
|------|---------|-------|----------------|----------------------|
| `DATE` | 3 bytes | 1000-01-01 to 9999-12-31 | No | N/A |
| `TIME(fsp)` | 3 bytes + 0-3 bytes | -838:59:59 to 838:59:59 | No | 0-6 digits |
| `DATETIME(fsp)` | 8 bytes + 0-3 bytes | 1000-01-01 00:00:00 to 9999-12-31 23:59:59 | No | 0-6 digits |
| `TIMESTAMP(fsp)` | 4 bytes + 0-3 bytes | 1970-01-01 00:00:01 to 2106-02-07 06:28:15 UTC | **Yes** | 0-6 digits |
| `YEAR` | 1 byte | 1901-2155 or 0000 | No | N/A |

**Microsecond Precision** (`fsp` = fractional seconds precision):

> "The datetime precision specifies number of digits after the decimal dot and can be any integer number from 0 to 6. If no precision is specified it is assumed to be 0."  
> — [MariaDB Microseconds Documentation](https://mariadb.com/kb/en/microseconds-in-mariadb/)

**Important**: When converting to lower precision, values are **truncated, not rounded**.

**DATETIME vs TIMESTAMP**:

**Use DATETIME when**:
- You need dates beyond 2038 (Y2038 problem) or before 1970
- You want timezone-independent storage
- You need historical or far-future dates

> "DATETIME stores absolute date-time combinations independent of time zone."  
> — [MariaDB DATETIME Documentation](https://mariadb.com/kb/en/datetime/)

**Use TIMESTAMP when**:
- You need automatic timezone conversion
- You want automatic `created_at` / `updated_at` tracking
- You're storing events tied to UTC

> "Inserted TIMESTAMP values are converted from the session's time zone to Coordinated Universal Time (UTC) when stored, and converted back to the session's time zone when retrieved."  
> — [MariaDB TIMESTAMP Documentation](https://mariadb.com/kb/en/timestamp/)

**Automatic Timestamp Behavior**:

> "By default, the first TIMESTAMP column receives DEFAULT CURRENT_TIMESTAMP and ON UPDATE CURRENT_TIMESTAMP."  
> — [MariaDB TIMESTAMP Documentation](https://mariadb.com/kb/en/timestamp/)

**Example**:
```sql
CREATE TABLE events (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    event_date DATETIME(3) NOT NULL,           -- Millisecond precision, timezone-independent
    created_at TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP(6),  -- Microsecond precision, auto-populated
    updated_at TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6)
) ENGINE=InnoDB;
```

**References**:
- [MariaDB DATETIME](https://mariadb.com/kb/en/datetime/)
- [MariaDB TIMESTAMP](https://mariadb.com/kb/en/timestamp/)
- [MariaDB Microseconds](https://mariadb.com/kb/en/microseconds-in-mariadb/)

### UUID Storage Strategies

MariaDB 10.7+ introduced a native `UUID` data type with optimized storage and indexing.

| Storage Method | Size | Index-Friendly | Version Support | Best For |
|----------------|------|----------------|-----------------|----------|
| `UUID` (native) | 16 bytes | **Yes** (reordered) | MariaDB 10.7+ | **Recommended** |
| `CHAR(36)` | 36-110 bytes (with UTF-8) | No | All versions | Legacy compatibility |
| `BINARY(16)` | 16 bytes | Partially | All versions | Manual optimization |

**Native UUID Type**:

> "The UUID data type is intended for storage of 128-bit UUID data with 128-bit storage optimization. UUID values are stored in an index-friendly manner."  
> — [MariaDB UUID Data Type](https://mariadb.com/kb/en/uuid-data-type/)

**Index-Friendly Storage**:

For UUIDv1, MariaDB reorders fields for sequential timestamp sorting:
- Standard format: `llllllll-mmmm-Vhhh-vsss-nnnnnnnnnnnn`
- Stored as: `nnnnnnnnnnnn-vsss-Vhhh-mmmm-llllllll`

> "UUID values version >= 6 are stored without byte-swapping, which helps with time-ordered operations."  
> — [MariaDB UUID Data Type](https://mariadb.com/kb/en/uuid-data-type/)

**Performance Considerations**:

> "GUIDs/UUIDs are very random, so INSERTing into an index means jumping around a lot. Once the index is too big to be cached, most INSERTs involve a disk hit, limiting you to a few hundred INSERTs per second."  
> — [MariaDB GUID/UUID Performance](https://mariadb.com/kb/en/guiduuid-performance/)

**Optimization Strategies**:

1. **Use UUIDv7** (time-ordered) instead of UUIDv4 (random) for primary keys
2. **Use native UUID type** instead of CHAR(36) to save 20-94 bytes per entry
3. **For legacy databases**: Convert CHAR(36) UUIDs to BINARY(16) using `UNHEX()` and field reordering

**Example**:
```sql
-- MariaDB 10.7+
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT UUID_V7(),  -- Time-ordered, index-friendly
    email VARCHAR(255) NOT NULL UNIQUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- Legacy approach (MariaDB < 10.7)
CREATE TABLE users_legacy (
    id BINARY(16) PRIMARY KEY,  -- Store UUID as binary
    email VARCHAR(255) NOT NULL UNIQUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;
```

**References**:
- [MariaDB UUID Data Type](https://mariadb.com/kb/en/uuid-data-type/)
- [MariaDB GUID/UUID Performance](https://mariadb.com/kb/en/guiduuid-performance/)

---

## Normalization & Denormalization

### Normalization Levels

Database normalization is a systematic approach to organizing data to reduce redundancy and improve integrity.

> "Database normalization is a standard requirement of many database designs. It's a technique that helps you avoid data anomalies."  
> — [MariaDB Database Normalization](https://mariadb.com/kb/en/database-normalization/)

#### Third Normal Form (3NF) — The Practical Target

> "3rd normal form is usually sufficient for most tables because it avoids the most common kind of data anomalies."  
> — [MariaDB Database Normalization](https://mariadb.com/kb/en/database-normalization/)

**3NF Requirements**:

A table is in third normal form when:
1. It is in 2nd normal form
2. It contains **no transitive dependencies** (non-key attributes must not depend on other non-key attributes)

> "A table achieves third normal form when it is in 2nd normal form and contains no transitive dependencies (where a non-key attribute is dependent on the primary key through another non-key attribute)."  
> — [MariaDB Database Normalization: 3rd Normal Form](https://mariadb.com/kb/en/database-normalization-3rd-normal-form/)

**Example**:

❌ **Not in 3NF** (transitive dependency):
```sql
CREATE TABLE plants (
    plant_code INT PRIMARY KEY,
    plant_name VARCHAR(100),
    soil_category VARCHAR(50),
    soil_description TEXT  -- Depends on soil_category, not plant_code!
);
```

✅ **3NF Design**:
```sql
CREATE TABLE plants (
    plant_code INT PRIMARY KEY,
    plant_name VARCHAR(100),
    soil_category VARCHAR(50),
    FOREIGN KEY (soil_category) REFERENCES soil_types(category)
);

CREATE TABLE soil_types (
    category VARCHAR(50) PRIMARY KEY,
    description TEXT
);
```

**Higher Normal Forms** (Boyce-Codd, 4NF, 5NF):

These are rarely necessary for business applications. Only apply them if you deeply understand your data usage patterns.

**References**:
- [MariaDB Database Normalization](https://mariadb.com/kb/en/database-normalization/)
- [MariaDB Database Normalization: 3rd Normal Form](https://mariadb.com/kb/en/database-normalization-3rd-normal-form/)

### When to Denormalize

> "Denormalization is the process of reversing the transformations made during normalization for performance reasons."  
> — [MariaDB Understanding Denormalization](https://mariadb.com/kb/en/understanding-denormalization/)

**Denormalize only when**:

1. Performance with a normalized structure is **unacceptable**
2. You've verified that denormalization will make it **acceptable**
3. Other alternatives (better hardware, load balancing, indexing) have been **exhausted**

> "If your performance with a normalized structure is acceptable, you should not denormalize."  
> — [MariaDB Understanding Denormalization](https://mariadb.com/kb/en/understanding-denormalization/)

**Trade-offs of Denormalization**:

| Benefit | Cost |
|---------|------|
| Faster read queries (fewer JOINs) | Slower writes (update multiple locations) |
| Simpler queries | Data redundancy |
| Reduced JOIN overhead | Risk of data inconsistencies |
| | Application-specific schema (less flexible) |

**Common Denormalization Patterns**:

1. **Caching aggregates**: Store `order_total` in the `orders` table instead of calculating from `order_items`
2. **Duplicating frequently-joined data**: Store `customer_name` in `orders` table to avoid JOIN for display
3. **Materialized views**: Pre-compute complex JOINs into a summary table

**Best Practices**:

- Default to 3NF
- Denormalize only specific "hot paths" with proven performance issues
- Document denormalizations and maintain them carefully
- Consider read replicas or caching layers before denormalizing

**References**:
- [MariaDB Understanding Denormalization](https://mariadb.com/kb/en/understanding-denormalization/)

---

## Partitioning Strategies

Partitioning divides large tables into smaller, more manageable pieces while maintaining a single logical table.

> "Read and write performance are affected by the partitioning expression. Therefore, these choices should be made carefully."  
> — [MariaDB Partitioning Types Overview](https://mariadb.com/kb/en/partitioning-types-overview/)

### RANGE Partitioning

**Use when**: Data naturally divides by continuous ranges (dates, IDs, numeric ranges).

> "Ranges must be ordered, contiguous and non-overlapping."  
> — [MariaDB RANGE Partitioning Type](https://mariadb.com/kb/en/range-partitioning-type/)

**Primary use case**:

> "Partition a table whose rows refer to a moment or period in time; for example commercial transactions, blog posts, or events."  
> — [MariaDB RANGE Partitioning Type](https://mariadb.com/kb/en/range-partitioning-type/)

**Benefits**:
- Efficient partition pruning for date/range queries
- Easy to drop old partitions (`ALTER TABLE DROP PARTITION`)
- Separates hot (recent) data from cold (historical) data

**Example**:
```sql
CREATE TABLE events (
    id INT UNSIGNED AUTO_INCREMENT,
    event_date DATE NOT NULL,
    event_type VARCHAR(50),
    data JSON,
    PRIMARY KEY (id, event_date)
) ENGINE=InnoDB
PARTITION BY RANGE (YEAR(event_date)) (
    PARTITION p2022 VALUES LESS THAN (2023),
    PARTITION p2023 VALUES LESS THAN (2024),
    PARTITION p2024 VALUES LESS THAN (2025),
    PARTITION p2025 VALUES LESS THAN (2026),
    PARTITION p_future VALUES LESS THAN MAXVALUE
);
```

**Best Practices**:
- Use `MAXVALUE` for the final partition to catch new values
- Include partition key in the primary key
- Use `TO_DAYS()` or `YEAR()` for date-based partitioning

**References**:
- [MariaDB RANGE Partitioning Type](https://mariadb.com/kb/en/range-partitioning-type/)

### LIST Partitioning

**Use when**: Data naturally groups by discrete categorical values.

> "LIST partitioning can be useful when you have a column that can only contain a limited set of values."  
> — [MariaDB LIST Partitioning Type](https://mariadb.com/kb/en/list-partitioning-type/)

**How it works**:

> "With the LIST type, you assign a set of values to each partition. If the partitioning expression returns one of the specified values, the row is stored in that partition."  
> — [MariaDB LIST Partitioning Type](https://mariadb.com/kb/en/list-partitioning-type/)

**Example**:
```sql
CREATE TABLE customers (
    id INT UNSIGNED AUTO_INCREMENT,
    name VARCHAR(255),
    region VARCHAR(50),
    PRIMARY KEY (id, region)
) ENGINE=InnoDB
PARTITION BY LIST COLUMNS(region) (
    PARTITION p_north VALUES IN ('North', 'Northeast', 'Northwest'),
    PARTITION p_south VALUES IN ('South', 'Southeast', 'Southwest'),
    PARTITION p_central VALUES IN ('Central', 'Midwest'),
    PARTITION p_other DEFAULT  -- Catches all other values
);
```

**Best Practices**:
- Use `DEFAULT` partition to catch unexpected values
- Use `LIST COLUMNS` for non-integer partitioning keys
- Ideal for geographic regions, status codes, categories

**References**:
- [MariaDB LIST Partitioning Type](https://mariadb.com/kb/en/list-partitioning-type/)

### HASH Partitioning

**Use when**: You want automatic, even distribution across partitions without manual range/list definitions.

> "HASH partitioning makes use of the modulus of the hashing function's value. Data is more likely to be evenly distributed over the partitions than with LINEAR HASH."  
> — [MariaDB HASH Partitioning Type](https://mariadb.com/kb/en/hash-partitioning-type/)

**Calculation**: `MOD(partitioning_expression, number_of_partitions)`

**Best Practices**:

> "Use a non-constant, deterministic integer that returns consistent results. Single-column hashing functions are preferred over multi-column expressions."  
> — [MariaDB HASH Partitioning Type](https://mariadb.com/kb/en/hash-partitioning-type/)

**HASH vs LINEAR HASH**:

| HASH | LINEAR HASH |
|------|-------------|
| Better distribution | Less even distribution |
| Slower partition maintenance (ADD/DROP) | **Much faster** partition maintenance |
| Modulus algorithm | Powers-of-two algorithm |

**Use HASH when**: Data distribution is the priority  
**Use LINEAR HASH when**: You frequently add/drop/merge/split partitions

**Example**:
```sql
CREATE TABLE user_sessions (
    id BIGINT UNSIGNED AUTO_INCREMENT,
    user_id INT UNSIGNED NOT NULL,
    session_data BLOB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id, user_id)
) ENGINE=InnoDB
PARTITION BY HASH(user_id)
PARTITIONS 8;
```

**References**:
- [MariaDB HASH Partitioning Type](https://mariadb.com/kb/en/hash-partitioning-type/)

### KEY Partitioning

**Use when**: You want automatic partitioning by primary key or unique key without manual expressions.

> "KEY partitioning automatically distributes data across partitions using server-provided hash algorithms. KEY takes an optional list of column_names, and the hashing function is given by the server."  
> — [MariaDB KEY Partitioning Type](https://mariadb.com/kb/en/key-partitioning-type/)

**Key differences from HASH**:
- **Database-determined** hash function (not user-specified)
- **Not limited to integer or NULL values**
- Defaults to primary key if no columns specified

**Available Algorithms** (MariaDB 12.3+):

> "MYSQL55 (default), MYSQL51, CRC32C, XXH32, XXH3, BASE31"  
> — [MariaDB KEY Partitioning Type](https://mariadb.com/kb/en/key-partitioning-type/)

**Example**:
```sql
CREATE TABLE products (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    sku VARCHAR(50) NOT NULL UNIQUE,
    name VARCHAR(255),
    price DECIMAL(10,2)
) ENGINE=InnoDB
PARTITION BY KEY(sku)  -- Partition by SKU instead of ID
PARTITIONS 4;
```

**Best Practices**:
- Let the system use the primary key when no specific column is needed
- Use modern algorithms (CRC32C, XXH3) for better performance
- Ensure partitioning columns are NOT NULL

**References**:
- [MariaDB KEY Partitioning Type](https://mariadb.com/kb/en/key-partitioning-type/)

---

## Character Sets & Collations

### utf8mb3 vs utf8mb4

**Critical**: MariaDB's `utf8` is actually `utf8mb3` and **cannot store 4-byte Unicode characters** (emoji, rare CJK characters).

> "UTF8 is an alias for utf8mb3, but this can changed to utf8mb4 by changing the default value of the old_mode system variable."  
> — [MariaDB Unicode](https://mariadb.com/kb/en/unicode/)

**Storage Differences**:

| Character Set | Bytes per Character | Supports Emoji | Recommendation |
|--------------|---------------------|----------------|----------------|
| `utf8mb3` | 1-3 bytes | ❌ No | **Avoid** (legacy only) |
| `utf8mb4` | 1-4 bytes | ✅ Yes | **Always use** |

> "UTF8MB4 stores supplementary characters in four bytes, enabling support for characters beyond the basic multilingual plane."  
> — [MariaDB Unicode](https://mariadb.com/kb/en/unicode/)

**Default in Modern MariaDB**:

> "MariaDB 11.6 changed the default character set from latin1 to utf8mb4."  
> — [MariaDB Setting Character Sets and Collations](https://mariadb.com/kb/en/setting-character-sets-and-collations/)

**When to use utf8mb3**: Only for legacy compatibility with systems that cannot handle 4-byte UTF-8.

### Setting Character Sets and Collations at Each Level

Character sets and collations cascade hierarchically: **server → database → table → column**.

> "Character sets cascade from server down through databases, tables, and columns. When no collation is specified, the system applies the default for that character set."  
> — [MariaDB Setting Character Sets and Collations](https://mariadb.com/kb/en/setting-character-sets-and-collations/)

#### Server Level

Set in `my.cnf` or `my.ini`:
```ini
[mysqld]
character-set-server = utf8mb4
collation-server = utf8mb4_unicode_ci
```

Or dynamically:
```sql
SET character_set_server = 'utf8mb4';
SET collation_server = 'utf8mb4_unicode_ci';
```

#### Database Level

```sql
CREATE DATABASE mydb 
    CHARACTER SET utf8mb4 
    COLLATE utf8mb4_unicode_ci;

ALTER DATABASE mydb 
    CHARACTER SET utf8mb4 
    COLLATE utf8mb4_unicode_ci;
```

**Tip**: You can specify only the collation; the character set is inferred automatically.

#### Table Level

```sql
CREATE TABLE users (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) NOT NULL
) ENGINE=InnoDB 
  DEFAULT CHARSET=utf8mb4 
  COLLATE=utf8mb4_unicode_ci;

ALTER TABLE users 
    DEFAULT CHARSET=utf8mb4 
    COLLATE=utf8mb4_unicode_ci;
```

**Warning**: Use `MODIFY COLUMN` for individual columns instead of table-level conversion to avoid automatic data type changes.

> "When converting character sets with CONVERT TO CHARACTER SET, data types may automatically adjust—for instance, converting ASCII TEXT to utf8mb4 upgrades to MEDIUMTEXT to preserve capacity."  
> — [MariaDB Setting Character Sets and Collations](https://mariadb.com/kb/en/setting-character-sets-and-collations/)

#### Column Level

```sql
CREATE TABLE products (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
    description TEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci
);

ALTER TABLE products 
    MODIFY COLUMN name VARCHAR(255) 
    CHARACTER SET utf8mb4 
    COLLATE utf8mb4_unicode_ci;
```

### Collation Selection: utf8mb4_unicode_ci vs utf8mb4_general_ci

| Collation | Sorting Accuracy | Performance | Use Case |
|-----------|------------------|-------------|----------|
| `utf8mb4_unicode_ci` | **Accurate** (UCA-compliant) | Slower | User-facing data, correct sorting required |
| `utf8mb4_general_ci` | Less accurate | **Faster** | Internal identifiers, performance-critical |
| `utf8mb4_uca1400_ai_ci` | **Most accurate** (UCA 14.0.0) | Slowest | Default in MariaDB 11.6+ |

**Performance Consideration**:

> "Poor performance with MariaDB 11 and utf8mb4_unicode_ci (vs utf8mb4_general_ci): two primary SQL queries became significantly slower, taking over 8 seconds compared to 3 seconds, and MariaDB could no longer utilize an index that was working before."  
> — [MariaDB Community: Poor Performance with utf8mb4_unicode_ci](https://mariadb.com/kb/en/the-community-poor-performance-with-mariadb-11-and-utf8mb4_unicode_ci-vs-ut/)

**Best Practices**:
- Use `utf8mb4_unicode_ci` for user-facing text (names, addresses, content)
- Use `utf8mb4_general_ci` for internal keys, system data, or performance-critical columns
- **Always match collations** across JOINed columns to avoid index disabling

**References**:
- [MariaDB Unicode](https://mariadb.com/kb/en/unicode/)
- [MariaDB Setting Character Sets and Collations](https://mariadb.com/kb/en/setting-character-sets-and-collations/)
- [MariaDB Supported Character Sets and Collations](https://mariadb.com/kb/en/supported-character-sets-and-collations/)

---

## Storage Engine Selection

MariaDB supports multiple storage engines, each optimized for different workloads.

### InnoDB — The Default Choice

> "InnoDB is a good general transaction storage engine, and the best choice in most cases."  
> — [MariaDB Choosing the Right Storage Engine](https://mariadb.com/kb/en/choosing-the-right-storage-engine/)

**Key Features**:

- **ACID transactions** with full rollback support
- **Foreign keys** for referential integrity
- **MVCC** (Multi-Version Concurrency Control) for high concurrency
- **Crash recovery** via transaction logs
- **Row-level locking** (not table-level)

> "InnoDB is a general purpose transactional storage engine that is performant, ACID-compliant, and well-suited for most workloads."  
> — [MariaDB InnoDB Storage Engine Introduction](https://mariadb.com/kb/en/innodb-storage-engine-introduction/)

**ACID Properties**:

- **Atomicity**: Transactions complete fully or not at all
- **Consistency**: Data remains valid across transactions
- **Isolation**: Concurrent transactions don't interfere
- **Durability**: Committed data survives crashes

**Best Practices for InnoDB**:

> "Specify a primary key for every table using the most frequently queried column or columns, or an auto-increment value if there is no obvious primary key."  
> — [MySQL 8.0 Reference Manual: InnoDB Best Practices](https://dev.mysql.com/doc/refman/8.0/en/innodb-best-practices.html)

**Foreign Keys**:

> "Define foreign keys on join columns and declare those columns with the same data type in each table. Foreign keys automatically create indexes on referenced columns."  
> — [MySQL 8.0 Reference Manual: InnoDB Best Practices](https://dev.mysql.com/doc/refman/8.0/en/innodb-best-practices.html)

**When to use InnoDB**:
- **Default choice** for 99% of tables
- Applications requiring transactions
- Tables with frequent concurrent reads/writes
- Any table needing foreign key constraints

**References**:
- [MariaDB InnoDB Storage Engine Introduction](https://mariadb.com/kb/en/innodb-storage-engine-introduction/)
- [MySQL InnoDB Best Practices](https://dev.mysql.com/doc/refman/8.0/en/innodb-best-practices.html)
- [MariaDB ACID: Concurrency Control with Transactions](https://mariadb.com/kb/en/acid-concurrency-control-with-transactions)

### Aria — Crash-Safe MyISAM Alternative

> "Aria is MariaDB's more modern improvement on MyISAM, has a small footprint and allows for easy copying between systems."  
> — [MariaDB Choosing the Right Storage Engine](https://mariadb.com/kb/en/choosing-the-right-storage-engine/)

**Key Features**:

- **Crash-safe** tables (with `TRANSACTIONAL` option)
- **Better caching** than MyISAM
- **Faster for temporary tables**
- **No true transactions** (despite the name)

> "Aria logs any changes to the table to Aria's transaction log, and syncs those writes at the end of the statement. However, it's important to note that despite its name, this feature provides crash-safety rather than true ACID transactions."  
> — [MariaDB Aria Storage Engine](https://mariadb.com/kb/en/aria-storage-engine/)

**When to use Aria**:
- System tables (MariaDB uses Aria internally)
- Temporary tables (automatically used in many cases)
- Read-heavy tables with infrequent writes
- Tables that need easy file-level copying between systems

**When NOT to use Aria**:
- Tables requiring true transactions
- Tables needing foreign keys
- High-concurrency write workloads (use InnoDB instead)

**References**:
- [MariaDB Aria Storage Engine](https://mariadb.com/kb/en/aria-storage-engine/)
- [MariaDB Aria FAQ](https://mariadb.com/kb/en/aria-faq/)

### MEMORY — In-Memory Temporary Storage

> "MEMORY does not write data on-disk (all rows are lost on crash) and is best-used for read-only caches of data from other tables, or for temporary work areas."  
> — [MariaDB Choosing the Right Storage Engine](https://mariadb.com/kb/en/choosing-the-right-storage-engine/)

**Key Characteristics**:

- **All data in RAM** (not persisted)
- **Data lost on server restart**
- **Fixed-size rows** (no dynamic growth)
- **HASH and BTREE indexes** supported

**When to use MEMORY**:
- Temporary lookup tables
- Session state storage
- Read-only caches (regenerated on startup)
- User-defined temporary tables

**When NOT to use MEMORY**:
- Any data that must persist
- Large datasets (limited by available RAM)
- Modern applications (InnoDB buffer pool often suffices)

**Alternative**: InnoDB with sufficient `innodb_buffer_pool_size` often performs as well without data loss risk.

**References**:
- [MariaDB Choosing the Right Storage Engine](https://mariadb.com/kb/en/choosing-the-right-storage-engine/)
- [MariaDB Storage Engines Overview](https://mariadb.com/kb/en/storage-engines-overview/)

### Storage Engine Comparison

| Feature | InnoDB | Aria | MEMORY |
|---------|--------|------|--------|
| **Transactions** | ✅ Full ACID | ❌ No | ❌ No |
| **Foreign Keys** | ✅ Yes | ❌ No | ❌ No |
| **Crash Recovery** | ✅ Yes | ✅ Yes (crash-safe) | ❌ No |
| **Persistence** | ✅ On-disk | ✅ On-disk | ❌ RAM only |
| **Concurrency** | ✅ Row-level locks | ⚠️ Table-level locks | ⚠️ Table-level locks |
| **Portability** | ⚠️ Binary logs required | ✅ Easy file copying | N/A |
| **Best Use Case** | General-purpose OLTP | System tables, temp tables | Temporary caches |

---

## Primary Keys & Indexing

### Primary Key Best Practices

> "Every InnoDB table has a PRIMARY KEY. While there is a default if you do not specify one, it is best to explicitly provide a PK."  
> — [MariaDB Getting Started with Indexes](https://mariadb.com/kb/en/getting-started-with-indexes/)

**Why Primary Keys Matter in InnoDB**:

InnoDB uses a **clustered index** structure where:
- The primary key **is** the table data (not a separate index)
- All secondary indexes store the primary key value (not row pointer)
- Short primary keys save space in every secondary index

> "If the primary key is long, the secondary indexes use more space, so it is advantageous to have a short primary key."  
> — [MySQL 8.0 Reference Manual: InnoDB Best Practices](https://dev.mysql.com/doc/refman/8.0/en/innodb-best-practices.html)

**Best Practices**:

1. **Use AUTO_INCREMENT integers** for surrogate keys:
   ```sql
   id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY
   ```

2. **Use UNSIGNED** to double the positive range:
   - `INT UNSIGNED`: 0 to 4,294,967,295 (4.2 billion)
   - `BIGINT UNSIGNED`: 0 to 18,446,744,073,709,551,615

3. **Keep primary keys short** to minimize secondary index overhead

4. **Use composite primary keys** only when natural keys exist:
   ```sql
   PRIMARY KEY (user_id, timestamp)
   ```

### Index Best Practices

> "Strategically add indexes to match your application's access patterns: Create indexes aligned with WHERE clauses, JOIN conditions, and ORDER BY statements."  
> — [MariaDB Getting Started with Indexes](https://mariadb.com/kb/en/getting-started-with-indexes/)

**When to Add Indexes**:

- Columns in `WHERE` clauses
- Columns in `JOIN` conditions
- Columns in `ORDER BY` or `GROUP BY`
- Foreign key columns (automatically indexed in InnoDB)

**When NOT to Add Indexes**:

> "Extra indexes consume storage and can slow down INSERT, UPDATE, and DELETE operations."  
> — [MariaDB Getting Started with Indexes](https://mariadb.com/kb/en/getting-started-with-indexes/)

**Index Types**:

| Type | Characteristics | Use Case |
|------|----------------|----------|
| **Primary Key** | Unique, NOT NULL, one per table | Clustered index (InnoDB) |
| **Unique Index** | Unique, allows multiple NULLs | Email, username, SKU |
| **Plain Index** | Allows duplicates | General search columns |
| **Composite Index** | Multi-column | Queries filtering on multiple columns |
| **Prefix Index** | First N characters | VARCHAR/TEXT columns |

**Composite Index Best Practices**:

- **Most selective column first** (highest cardinality)
- Index columns in the order they appear in queries
- Leftmost prefix rule: `INDEX(a,b,c)` covers queries on `a`, `a,b`, and `a,b,c` (but not `b` or `c` alone)

**EXPLAIN is Your Friend**:

> "Use the EXPLAIN statement to verify indexes are being utilized effectively and identify columns that might benefit from indexing."  
> — [MariaDB Getting Started with Indexes](https://mariadb.com/kb/en/getting-started-with-indexes/)

**References**:
- [MariaDB Getting Started with Indexes](https://mariadb.com/kb/en/getting-started-with-indexes/)
- [MariaDB Optimization and Indexes](https://mariadb.com/kb/en/optimization-and-indexes/)
- [MySQL 8.0 Reference Manual: InnoDB Best Practices](https://dev.mysql.com/doc/refman/8.0/en/innodb-best-practices.html)

---

## Summary Checklist

### Data Types
- ✅ Use the smallest data type that fits your requirements
- ✅ Use `UNSIGNED` for non-negative values
- ✅ Use `DECIMAL` for financial data
- ✅ Use `VARCHAR` for indexed strings, `TEXT` for large content
- ✅ Use `DATETIME` for timezone-independent dates, `TIMESTAMP` for UTC-aware timestamps
- ✅ Use native `UUID` type in MariaDB 10.7+ with UUIDv7 for sequential insertion

### Normalization
- ✅ Normalize to 3NF by default
- ✅ Denormalize only for proven performance issues
- ✅ Eliminate transitive dependencies

### Partitioning
- ✅ Use RANGE for time-series data
- ✅ Use LIST for categorical data
- ✅ Use HASH/KEY for automatic distribution
- ✅ Include partition key in primary key

### Character Sets
- ✅ Always use `utf8mb4`, never `utf8` (utf8mb3)
- ✅ Use `utf8mb4_unicode_ci` for user-facing data
- ✅ Match collations across JOINed columns
- ✅ Set character sets at database level in `CREATE DATABASE`

### Storage Engines
- ✅ Use InnoDB for 99% of tables
- ✅ Use Aria for temporary tables and system tables
- ✅ Avoid MEMORY unless data loss is acceptable

### Indexing
- ✅ Always define explicit primary keys
- ✅ Use `INT UNSIGNED AUTO_INCREMENT` for surrogate keys
- ✅ Keep primary keys short
- ✅ Index foreign key columns
- ✅ Match data types in foreign key relationships
- ✅ Use `EXPLAIN` to verify index usage

---

## References

All recommendations in this document are sourced from official MariaDB and MySQL documentation:

### MariaDB Knowledge Base
- [Data Types](https://mariadb.com/kb/en/data-types/)
- [Data Type Storage Requirements](https://mariadb.com/kb/en/data-type-storage-requirements/)
- [VARCHAR](https://mariadb.com/kb/en/varchar/)
- [TEXT](https://mariadb.com/kb/en/text/)
- [DECIMAL](https://mariadb.com/kb/en/decimal/)
- [DATETIME](https://mariadb.com/kb/en/datetime/)
- [TIMESTAMP](https://mariadb.com/kb/en/timestamp/)
- [Microseconds in MariaDB](https://mariadb.com/kb/en/microseconds-in-mariadb/)
- [UUID Data Type](https://mariadb.com/kb/en/uuid-data-type/)
- [GUID/UUID Performance](https://mariadb.com/kb/en/guiduuid-performance/)
- [Database Normalization](https://mariadb.com/kb/en/database-normalization/)
- [Database Normalization: 3rd Normal Form](https://mariadb.com/kb/en/database-normalization-3rd-normal-form/)
- [Understanding Denormalization](https://mariadb.com/kb/en/understanding-denormalization/)
- [Partitioning Types Overview](https://mariadb.com/kb/en/partitioning-types-overview/)
- [RANGE Partitioning Type](https://mariadb.com/kb/en/range-partitioning-type/)
- [LIST Partitioning Type](https://mariadb.com/kb/en/list-partitioning-type/)
- [HASH Partitioning Type](https://mariadb.com/kb/en/hash-partitioning-type/)
- [KEY Partitioning Type](https://mariadb.com/kb/en/key-partitioning-type/)
- [Unicode](https://mariadb.com/kb/en/unicode/)
- [Setting Character Sets and Collations](https://mariadb.com/kb/en/setting-character-sets-and-collations/)
- [Supported Character Sets and Collations](https://mariadb.com/kb/en/supported-character-sets-and-collations/)
- [Choosing the Right Storage Engine](https://mariadb.com/kb/en/choosing-the-right-storage-engine/)
- [InnoDB Storage Engine Introduction](https://mariadb.com/kb/en/innodb-storage-engine-introduction/)
- [Aria Storage Engine](https://mariadb.com/kb/en/aria-storage-engine/)
- [ACID: Concurrency Control with Transactions](https://mariadb.com/kb/en/acid-concurrency-control-with-transactions)
- [Getting Started with Indexes](https://mariadb.com/kb/en/getting-started-with-indexes/)
- [Optimization and Indexes](https://mariadb.com/kb/en/optimization-and-indexes/)

### MySQL Documentation
- [MySQL 8.0 Reference Manual: Choosing the Right Type for a Column](https://dev.mysql.com/doc/refman/8.0/en/choosing-types.html)
- [MySQL 8.0 Reference Manual: InnoDB Best Practices](https://dev.mysql.com/doc/refman/8.0/en/innodb-best-practices.html)
