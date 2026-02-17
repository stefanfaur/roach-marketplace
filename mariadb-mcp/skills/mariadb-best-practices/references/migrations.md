# MariaDB Schema Migration Best Practices

A comprehensive reference for MariaDB schema migrations covering Flyway, Liquibase, zero-downtime strategies, and migration tools.

---

## Table of Contents

1. [Flyway Configuration for MariaDB](#flyway-configuration-for-mariadb)
2. [Liquibase MariaDB Support](#liquibase-mariadb-support)
3. [Zero-Downtime DDL Strategies](#zero-downtime-ddl-strategies)
4. [Online Schema Change Tools](#online-schema-change-tools)
5. [Character Set and Collation](#character-set-and-collation)
6. [Foreign Key Management](#foreign-key-management)
7. [Column Operations](#column-operations)
8. [Table Operations](#table-operations)
9. [Rollback Strategies](#rollback-strategies)
10. [Migration Ordering and Dependencies](#migration-ordering-and-dependencies)
11. [Testing Migrations](#testing-migrations)

---

## Flyway Configuration for MariaDB

### Driver Configuration

**JDBC URL Formats:**
- `jdbc:mysql://_host_:_port_/_database_`
- `jdbc:mariadb://_host_:_port_/_database_`

**Important:** Since Flyway 10.7.0, the MariaDB driver no longer accepts MySQL URLs by default. To continue using MySQL URLs with the MariaDB driver, add `permitMysqlScheme=true` to your database URL.

Source: [MariaDB Driver Reference - Redgate Flyway](https://documentation.red-gate.com/flyway/reference/database-driver-reference/mariadb)

**Driver Details:**
- Default Java Class: `org.mariadb.jdbc.Driver`
- Maven Coordinates: `org.mariadb.jdbc:mariadb-java-client`
- Supported Driver Versions: 2.0.0 and later
- SSL Support: Yes (append `?useSsl=true` to connection URL)
- Included in CLI: Yes, ships with Flyway Command-line

**Dependency Configuration:**
```xml
<!-- Maven (Redgate) -->
<dependency>
    <groupId>com.redgate.flyway</groupId>
    <artifactId>flyway-mysql</artifactId>
</dependency>
```

MariaDB support is located within the `flyway-mysql` plugin module.

Source: [MariaDB Driver Reference - Redgate Flyway](https://documentation.red-gate.com/flyway/reference/database-driver-reference/mariadb)

### Baseline for Existing Databases

**When You Need Baselining:**

Baselining establishes the starting point before Flyway runs migrations against an existing database. It marks the current state and creates a record in the Flyway schema history table.

Before running migrations for the first time on an existing database, run the `baseline` command or use the `-baselineOnMigrate` flag with the `migrate` command.

Source: [Baselines - Redgate Flyway](https://documentation.red-gate.com/fd/baselines-273973441.html)

**Baseline Migration Format:**

Baseline migrations are prefixed with `B` followed by the version. For example:
- `B5__my_database.sql` represents the state after applying versioned migrations up to and including V5

Source: [Baseline Migrations - Redgate Flyway](https://documentation.red-gate.com/fd/baseline-migrations-273973336.html)

**Best Practices:**
1. **Export database schema as SQL** for the baseline state
2. **Filter out invalid database objects** before creating baseline
3. For large schemas, consider **provisioning approach** (cloning, backup, or snapshot)
4. **Rebaseline periodically** to consolidate numerous old migrations

Source: [Baselines - Redgate Flyway](https://documentation.red-gate.com/fd/baselines-273973441.html)

### Versioned vs Repeatable Migrations

**Versioned Migrations:**
- Format: `V<version>__<description>.sql` (e.g., `V001.002__NewTwitterColumn.sql`)
- Applied exactly once
- Have unique version, description, and checksum
- Applied in numerical order
- **Best practice:** Never modify after applying to permanent environments; create new migration instead

**Repeatable Migrations:**
- Format: `R__<description>.sql` (e.g., `R__Best_seller_view.sql`)
- Have description and checksum, but no version
- Re-applied every time their checksum changes
- Applied in alphabetical order by description
- Use cases: Database views, stored procedures, functions

**Execution Order:**
Within a single migration run, all pending versioned migrations are applied first, followed by any changed repeatable migrations.

Source: [Versioned Migrations - Redgate Flyway](https://documentation.red-gate.com/fd/versioned-migrations-273973333.html), [Migrations - Redgate Flyway](https://documentation.red-gate.com/fd/migrations-271585107.html)

**Version Numbering:**
- Simple increasing integers with zero-padding work for most cases
- Flyway Desktop generates timestamps by default to avoid team conflicts
- Versions are sorted numerically
- Checksums detect accidental changes to applied migrations

Source: [Versioned Migrations - Redgate Flyway](https://documentation.red-gate.com/fd/versioned-migrations-273973333.html)

---

## Liquibase MariaDB Support

### Supported Platforms

**Supported:**
- MariaDB Platform (Server, ColumnStore, MaxScale)
- MariaDB Cloud (MariaDB SkySQL)
- Amazon RDS MariaDB

**Not Supported:**
- MariaDB Xpand

Source: [What support does Liquibase have for MariaDB?](https://docs.liquibase.com/start/tutorials/mariadb.html)

### Connection Configuration

**Database URL:**
```
url: jdbc:mariadb://<host>:<port>/<dbname>
```

The latest version of Liquibase has a pre-installed driver for MariaDB in the `$LIQUIBASE_HOME/internal/lib` directory.

Source: [Connect Liquibase with MariaDB Server](https://docs.liquibase.com/oss/integration-guide-4-33/connect-liquibase-with-mariadb-server)

### Change Types and Commands

**Change Type Support:**
- 51 change types supported for MariaDB
- Fully supported: `createTable`, `addColumn`, `createIndex`, `createProcedure`, `createTrigger`, `dropTable`, `renameTable`, `modifyDataType`, and most standard DDL operations
- Not supported (6 types): `createSynonym`, `dropSynonym`, `disableCheckConstraint`, `disableTrigger`, `enableCheckConstraint`, `enableTrigger`, `markUnused`, `renameSequence`, `renameTrigger`

**Command Support:**
All 38 Liquibase commands are supported for MariaDB.

Source: [What support does Liquibase have for MariaDB?](https://docs.liquibase.com/start/tutorials/mariadb.html)

### Changesets and Rollbacks

**Changesets:**
Create a changelog file (.sql, .yaml, .json, or .xml) in your project directory and add changesets.

**Rollback Mechanism:**
- Liquibase reads changesets in order during updates
- During rollback, Liquibase rolls back sequentially in reverse order
- **Must specify custom rollback syntax** for every changeset you might want to roll back
- Use `<rollback>` tag with SQL statements, Change Types, or reference to previous changeset

**Automatic vs Custom Rollbacks:**
- Liquibase **cannot automatically generate rollback SQL** for operations like `dropTable` and `insert`
- Must write custom rollback statements for these changesets

Source: [Liquibase Rollback Workflow](https://docs.liquibase.com/workflows/liquibase-community/using-rollback.html), [What is a Changeset?](https://docs.liquibase.com/concepts/changelogs/changeset.html)

### Preconditions

**Purpose:**
Preconditions are conditional checks that control changeset execution based on database state. They specify security and standardization requirements.

**onFail Behavior Options:**
- `CONTINUE`: Skips the changeset but retries on next execution
- `HALT`: Stops entire changelog execution (default)
- `MARK_RAN`: Skips changeset but marks it as executed
- `WARN`: Issues a warning and continues normally

**Common Precondition Types:**
- `dbms`: Verifies database type (use "mysql" for MariaDB compatibility)
- `tableExists` / `columnExists`: Checks for table/column presence
- `sqlCheck`: Executes SQL and validates results
- `rowCount`: Confirms expected row quantities
- `primaryKeyExists` / `foreignKeyConstraintExists`: Validates constraints

**Best Practices:**
1. Avoid hardcoding schema names unless creating objects outside default schema
2. Use preconditions to prevent unrecoverable changes like `dropTable`
3. Combine conditions logically using nested AND/OR/NOT tags
4. Control changeset execution based on database state

Source: [Preconditions](https://docs.liquibase.com/concepts/changelogs/preconditions.html), [What are preconditions?](https://docs.liquibase.com/pro/user-guide-4-33/what-are-preconditions)

---

## Zero-Downtime DDL Strategies

### ALTER TABLE Algorithm Hierarchy

MariaDB InnoDB supports four ALTER TABLE algorithms, ranked from most to least efficient:

1. **INSTANT** - Metadata-only changes, no data file modifications
2. **NOCOPY** - Avoids rebuilding the clustered index
3. **INPLACE** - Uses storage engine optimizations to avoid full table copies
4. **COPY** - Creates temporary table, migrates data, renames back

**Key Principle:** When you specify an algorithm other than COPY, MariaDB interprets it as a minimum efficiency threshold and uses the most efficient algorithm available.

Source: [InnoDB Online DDL Overview](https://mariadb.com/kb/en/innodb-online-ddl-overview/)

### ALGORITHM=INSTANT Operations

**Supported Column Operations:**
- `ADD COLUMN` (MariaDB 10.3.2+; must be last column in 10.3.2-10.3.x; any position in 10.4+)
- `DROP COLUMN` (MariaDB 10.4+)
- `MODIFY COLUMN` - Reordering (10.4+)
- `MODIFY COLUMN` - VARCHAR length (limited support; cannot cross 255/256-byte threshold except in REDUNDANT format)
- `MODIFY COLUMN` - Change to NULL (REDUNDANT format, 10.4.3+)
- `ENUM/SET` - Adding options to end (if storage requirements unchanged)
- Column renaming (name only, not data type)

**Supported Index & Constraint Operations:**
- `DROP FOREIGN KEY`
- `DROP CONSTRAINT` (CHECK constraints, 10.3.6+)

**Supported Table Operations:**
- Changing `AUTO_INCREMENT` value
- Setting/removing column `DEFAULT` values
- Enabling `PAGE_COMPRESSED` (10.3.10+)
- Changing `PAGE_COMPRESSION_LEVEL`
- Renaming tables (requires exclusive locking)

**NOT SUPPORTED:**
- Adding primary keys, plain indexes, fulltext indexes, spatial indexes
- Adding foreign key constraints
- Table rebuilds (FORCE, ENGINE=InnoDB, OPTIMIZE TABLE)

**Critical Limitations:**
- Not available for `ROW_FORMAT=COMPRESSED`
- Incompatible with tables containing FULLTEXT INDEX columns
- Data files become incompatible with older MariaDB/MySQL versions

Source: [InnoDB INSTANT Algorithm Operations](https://mariadb.com/kb/en/innodb-online-ddl-operations-with-the-instant-alter-algorithm/), [Instant ADD COLUMN for InnoDB](https://mariadb.com/kb/en/instant-add-column-for-innodb/)

### ALGORITHM=NOCOPY Operations

**Supported Operations:**
- Column operations where INSTANT is supported
- `ADD` plain indexes (LOCK=NONE, allows concurrent DML)
- `ADD FULLTEXT` indexes (LOCK=SHARED, read-only DML)
- `ADD SPATIAL` indexes (LOCK=SHARED, read-only DML)
- `DROP` indexes where INSTANT supported
- `ADD FOREIGN KEY` (requires `foreign_key_checks=OFF`, LOCK=NONE)
- `DROP FOREIGN KEY` where INSTANT supported
- `AUTO_INCREMENT` changes, `PAGE_COMPRESSED` settings
- `DROP CONSTRAINT`, `RENAME` operations

**NOT SUPPORTED:**
- ADD/DROP PRIMARY KEY
- MODIFY COLUMN data type (most cases)
- MODIFY COLUMN to NOT NULL
- Change ROW_FORMAT or KEY_BLOCK_SIZE
- DROP SYSTEM VERSIONING
- FORCE rebuild, ENGINE=InnoDB reassignment

Source: [InnoDB NOCOPY Algorithm Operations](https://mariadb.com/kb/en/innodb-online-ddl-operations-with-the-nocopy-alter-algorithm/)

### ALGORITHM=INPLACE Operations

**Operations Allowing Concurrent DML (LOCK=NONE):**

**Column Operations:**
- `ADD COLUMN` (except auto-increment columns)
- `DROP COLUMN`
- `MODIFY COLUMN` (reordering, changing to NULL, changing to NOT NULL)
- `ADD ENUM/SET` option (to end of list only)
- Remove system versioning from column
- `ALTER COLUMN` (set/drop DEFAULT)
- `CHANGE COLUMN` (rename only, no type changes)

**Index Operations:**
- `ADD INDEX` (plain indexes)
- `DROP INDEX`
- `ADD FOREIGN KEY` (requires `foreign_key_checks=OFF`)
- `DROP FOREIGN KEY`

**Table Operations:**
- `AUTO_INCREMENT` value changes
- `ROW_FORMAT` changes
- `KEY_BLOCK_SIZE` changes
- `PAGE_COMPRESSED` and `PAGE_COMPRESSION_LEVEL` changes
- `FORCE` rebuild
- `ENGINE=InnoDB`
- `DROP CONSTRAINT` (CHECK constraints)

**Operations with Read-Only Locking (LOCK=SHARED):**
- `ADD FULLTEXT INDEX`
- `ADD SPATIAL INDEX`
- `DROP SYSTEM VERSIONING`

**Operations with Exclusive Locking (LOCK=EXCLUSIVE):**
- `RENAME TO` / `RENAME TABLE` (concurrent DML **not** permitted)

Source: [InnoDB INPLACE Algorithm Operations](https://mariadb.com/kb/en/innodb-online-ddl-operations-with-the-inplace-alter-algorithm/)

### ALGORITHM=COPY

**Characteristics:**
- Creates temporary table with new definition
- Copies data from original table
- Drops original table
- Renames temporary table
- **Extremely slow** for large tables
- Requires exclusive lock during operation
- Duration largely dependent on table size

**When Used:**
- Operations not supported by INSTANT, NOCOPY, or INPLACE
- Fallback when no optimization available

Source: [InnoDB Online DDL Overview](https://mariadb.com/kb/en/innodb-online-ddl-overview/)

### Lock Types and Concurrency

**Lock Types:**
- `NONE`: Permits all concurrent DML operations
- `SHARED`: Allows read-only concurrent access
- `EXCLUSIVE`: Blocks all concurrent DML
- `DEFAULT`: Uses the least restrictive lock available

**Important:** InnoDB exclusively locks the table for a short time at the start and end of operations, regardless of algorithm chosen.

Source: [InnoDB Online DDL Overview](https://mariadb.com/kb/en/innodb-online-ddl-overview/)

### Metadata Locking Considerations

**Core Behavior:**
When a transaction uses a table, it locks its metadata until the end of the transaction. When a DDL statement like ALTER TABLE attempts to modify that table, it is queued and must wait until the table is unlocked.

**Timeout Configuration:**
- Controlled by `lock_wait_timeout` server variable (in seconds)
- **Default value: 31536000 (1 year)**
- Exceeding timeout produces error 1205

**Impact of Long-Running Transactions:**
Active transactions holding table access prevent structural modifications. ALTER TABLE operations wait until all transactions release their locks.

**Migration Strategies:**
1. Minimize transaction duration on tables requiring structural changes
2. Adjust `lock_wait_timeout` to realistic values before migrations
3. Ensure long-running transactions complete before schema modifications
4. Note: Savepoints and partial rollbacks **do not release metadata locks**

Source: [Metadata Locking](https://mariadb.com/kb/en/metadata-locking/)

---

## Online Schema Change Tools

### pt-online-schema-change vs gh-ost

Both tools provide alternatives to direct ALTER TABLE for large tables by creating complex procedures to track changes while building a new table with the new structure.

### pt-online-schema-change (Percona)

**How It Works:**
- Creates temporary table with new schema
- Uses **triggers to mirror changes** from original table
- Background process copies data using LOW_PRIORITY INSERT statements
- Atomic RENAME TABLE operation at completion

**Key Limitations:**
- **Unavoidable overhead:** Every operation is duplicated through triggers, even when paused
- **Metadata lock issues:** Acquiring locks to create triggers can block concurrent traffic
- **Foreign key problems:** Lacks robust foreign key handling; workarounds risk data loss
- **Trigger limitations:** Pre-5.7 MySQL couldn't support multiple triggers of same type
- **Still better than gh-ost for foreign keys:** Provides some workarounds vs no support

**When to Use:**
- Galera Cluster deployments
- Schemas with foreign key dependencies
- Tables with existing triggers (MySQL 5.7+)

Source: [Online Schema Change for MySQL & MariaDB - Comparing gh-ost vs pt-online-schema-change](https://severalnines.com/blog/online-schema-change-mysql-mariadb-comparing-github-s-gh-ost-vs-pt-online-schema-change/)

### gh-ost (GitHub)

**How It Works:**
- **Triggerless approach** using binary logs
- Connects to slave (or master) to read binary logs
- Applies changes asynchronously
- Copies data in chunked INSERT...SELECT queries using primary key

**Advantages:**
- **Zero paused overhead:** When stopped, adds no additional workload
- **No metadata locks:** Avoids trigger-related locking problems
- **Complete pausability:** Binary log coordinates allow resuming from exact stopping point
- Better operational control and production stability

**Critical Limitations:**
- **No Galera Cluster support:** Uses LOCK TABLE statements incompatible with Galera
- **Foreign key incompatibility:** Currently unsupported entirely
- **Binary log requirements:** Needs row-based replication format; statement/mixed won't work
- **Additional constraints:** Doesn't support triggers, JSON columns, generated columns, minimal row images, or migration keys with NULL values

**When to Use:**
- MySQL replication setups
- Prioritizing production stability
- Need for operational control (pause/resume)
- No foreign key dependencies

Source: [Online Schema Change for MySQL & MariaDB - Comparing gh-ost vs pt-online-schema-change](https://severalnines.com/blog/online-schema-change-mysql-mariadb-comparing-github-s-gh-ost-vs-pt-online-schema-change/)

### Performance Considerations

**Both tools are much slower than direct ALTER:**
- A change taking hours with ALTER may take days with pt-osc or gh-ost
- Both require a primary or unique key in the table
- Can operate on large tables without locking writes

**Requirements:**
- Primary or unique key must exist in the table
- Sufficient disk space for duplicate table
- Monitor replication lag (if applicable)

Source: [Online Schema Change for MySQL & MariaDB - Comparing gh-ost vs pt-online-schema-change](https://severalnines.com/blog/online-schema-change-mysql-mariadb-comparing-github-s-gh-ost-vs-pt-online-schema-change/)

---

## Character Set and Collation

### Best Practices

**Always specify explicit CHARACTER SET and COLLATE in migration DDL.**

**Hierarchy:**
Character sets and collations cascade hierarchically: column → table → database → server. A column without a specified collation inherits from the table default, the table from the database, and the database from the server.

Source: [Setting Character Sets and Collations](https://mariadb.com/docs/server/reference/data-types/string-data-types/character-sets/setting-character-sets-and-collations)

### Modern Defaults

**Current MariaDB Defaults:**
- Character set: `utf8mb4`
- Collation: `utf8mb4_uca1400_ai_ci`

**Older Versions:**
- Character set: `latin1`
- Collation: `latin1_swedish_ci`

Source: [Character Set and Collation Overview](https://mariadb.com/kb/en/character-set-and-collation-overview/)

### UTF8MB4 Recommendation

**Use `utf8mb4` instead of `utf8`:**
- `utf8` only supports characters up to 3 bytes
- `utf8mb4` supports 4-byte characters, including emojis and less common Unicode characters
- `utf8mb4` is best practice and more robust

Source: [Setting Character Sets and Collations](https://mariadb.com/docs/server/reference/data-types/string-data-types/character-sets/setting-character-sets-and-collations)

### Migration Strategies

**Database-Level Changes:**
```sql
ALTER DATABASE mydb CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

**Important:** Changing database default does **not** change existing stored procedures or functions. These must be dropped and recreated.

**Column Conversion:**
```sql
ALTER TABLE yourtable MODIFY columnname VARCHAR(255) 
CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

**Table Conversion:**
```sql
ALTER TABLE yourtable CONVERT TO CHARACTER SET utf8mb4 
COLLATE utf8mb4_unicode_ci;
```

Source: [Setting Character Sets and Collations](https://mariadb.com/docs/server/reference/data-types/string-data-types/character-sets/setting-character-sets-and-collations)

### Testing and Validation

**Test collation changes before production:**
- Different collations affect comparisons (e.g., German phone book collation treats "ue" and "ü" equivalently)
- Use `SET collation_connection` command to verify behavior
- Run `SHOW CHARACTER SET` and `SHOW COLLATION` to verify supported options

**Critical Consistency:**
Align character set and collation settings between server, database, tables, and clients. Differences can cause encoding problems and data corruption.

Source: [Character Set and Collation Overview](https://mariadb.com/kb/en/character-set-and-collation-overview/)

---

## Foreign Key Management

### Index Requirements

**Foreign keys require specific indexing:**

**Referenced columns** (parent table):
- Must be an index or a prefix of an index

**Child table columns:**
- Must use BTREE indexes
- Cannot be HASH, RTREE, or FULLTEXT indexes
- Index prefixes not supported
- TEXT and BLOB columns **cannot be used as foreign keys**

Source: [Foreign Keys](https://mariadb.com/kb/en/foreign-keys/)

### Automatic Index Creation

**MariaDB auto-creates indexes for foreign keys:**

When a foreign key constraint is added to a column without an index, InnoDB automatically creates an index to enforce the constraint. The automatically-created index name is specified by the `index_name` parameter in the foreign key definition.

**Best Practice:** Define indexes explicitly before foreign key constraints to maintain control over naming and structure.

Source: [Foreign Keys](https://mariadb.com/kb/en/foreign-keys/)

### Type Matching Requirements

**Foreign key columns and referenced columns must:**
- Be of the same type or similar types
- For integer types: Same size and sign
- Use same storage engine (both tables must use InnoDB)
- Not be TEMPORARY or partitioned tables

Source: [Foreign Keys](https://mariadb.com/kb/en/foreign-keys/)

### Migration Best Practices

1. **Explicit index creation:** Create indexes before defining foreign key constraints
2. **Type matching:** Ensure exact type match including size and sign for integers
3. **Storage engine consistency:** Both tables must use same engine (InnoDB)
4. **Constraint naming:** Use descriptive names (e.g., `fk_book_author`) for clear error identification
5. **Data integrity first:** Insert parent records before child records
6. **Use LAST_INSERT_ID():** Maintain referential integrity during bulk migrations

Source: [Foreign Keys](https://mariadb.com/kb/en/foreign-keys/)

---

## Column Operations

### Adding Columns with Defaults

**Instant ADD COLUMN (MariaDB 10.3.2+):**

For large tables, instant ADD COLUMN transforms operations from hours to nearly instantaneous. Instead of O(n·m) operation requiring full table rebuild, it performs an O(1) operation inserting a special hidden record and updating data dictionary.

**Version Requirements:**
- MariaDB 10.3.2+: New columns must be added at the end
- MariaDB 10.4+: Columns can be added at any position

**DEFAULT Value Requirements:**
When adding NOT NULL columns instantly, a DEFAULT value must be provided:
- Either implied by the data type
- Or explicitly set by user
- Expressions can be dynamic (like `current_timestamp()`)
- Must not reference existing table columns

**Example:**
```sql
ALTER TABLE users 
ADD COLUMN created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
ALGORITHM=INSTANT;
```

**Performance:**
A hidden metadata record at the start of the clustered index stores each column's DEFAULT value, making it possible to add columns without rebuilding the table.

**Limitations:**
- Not supported with `ROW_FORMAT=COMPRESSED`
- Incompatible with tables containing FULLTEXT INDEX
- Data files become incompatible with older MariaDB/MySQL versions

Source: [Instant ADD COLUMN for InnoDB](https://mariadb.com/kb/en/instant-add-column-for-innodb/), [InnoDB INSTANT Algorithm Operations](https://mariadb.com/kb/en/innodb-online-ddl-operations-with-the-instant-alter-algorithm/)

### Dropping Columns Safely

**Data Loss Prevention:**

Dropping a column is **permanent and non-reversible**. Before dropping:

1. **Always create a backup** using `mariadb-dump` utility
2. Verify you truly want to delete the column and its data
3. Check if column is referenced in views or triggers (will cause errors on next access)
4. Check if column is part of multi-column UNIQUE constraint (not permitted)

**Automatic Index Adjustment:**
If the column is part of any index:
- Column will be dropped from the index
- Index will be dropped if all columns from that index were dropped
- Exception: If you add a new column with identical name at the same time

**Example:**
```sql
-- Safe drop with IF EXISTS
ALTER TABLE users DROP COLUMN IF EXISTS deprecated_field;
```

Source: [Altering Tables in MariaDB](https://mariadb.com/kb/en/altering-tables-in-mariadb/), [ALTER TABLE](https://mariadb.com/kb/en/alter-table/)

### Modifying Column Types

**VARCHAR Length Changes:**
- Limited support with ALGORITHM=INSTANT
- Cannot cross 255/256-byte threshold except in REDUNDANT row format
- COMPACT/DYNAMIC/COMPRESSED formats have byte-length restrictions

**NULL/NOT NULL Changes:**
- Change to NULL: Supported with REDUNDANT format (10.4.3+) using INSTANT
- Change to NOT NULL: Unsupported with INSTANT algorithm

Source: [InnoDB INSTANT Algorithm Operations](https://mariadb.com/kb/en/innodb-online-ddl-operations-with-the-instant-alter-algorithm/)

---

## Table Operations

### Renaming Tables vs Create New + Migrate

**RENAME TABLE Method:**

**Advantages:**
- Atomic operation
- Multiple tables can be renamed in single statement
- If one rename fails, all renames in statement are rolled back
- Can move table to another database: `RENAME TABLE db1.table TO db2.table;`
- Fast operation (metadata-only change)

**Requirements:**
- DROP, CREATE, and INSERT privileges for table or database

**Example:**
```sql
RENAME TABLE old_users TO users_archive, 
             new_users TO users;
```

Source: [RENAME TABLE](https://mariadb.com/docs/server/reference/sql-statements/data-definition/rename-table), [Altering Tables in MariaDB](https://mariadb.com/kb/en/altering-tables-in-mariadb/)

**Create New Table + Migrate Data Method:**

**When to Use:**
- Making structural changes simultaneously
- Reorganizing data during migration
- Need to validate data during migration
- Want to test new structure before cutover

**Process:**
1. Create temporary table with new definition
2. Copy data from original table
3. Drop original table
4. Rename temporary table

**Disadvantages:**
- More complex
- Requires more disk space
- Longer duration
- More points of failure

Source: [Altering Tables in MariaDB](https://mariadb.com/kb/en/altering-tables-in-mariadb/)

### Row Format Considerations

**InnoDB Row Formats:**
1. **DYNAMIC** (default, recommended): Most efficient storage, scales well
2. **COMPACT**: 20% less storage than REDUNDANT, legacy format
3. **REDUNDANT**: Oldest format, less efficient, not recommended
4. **COMPRESSED**: Similar to COMPACT but compressed; not recommended for production

**Best Practice:** Use DYNAMIC row format for new tables.

**Migration to DYNAMIC:**
```sql
ALTER TABLE mytable ROW_FORMAT=DYNAMIC;
```

**Finding Non-DYNAMIC Tables:**
Query `information_schema.INNODB_SYS_TABLES` to find tables using REDUNDANT or COMPACT formats.

**Important:** COMPRESSED row format does not support INSTANT ADD COLUMN.

Source: [InnoDB Row Formats Overview](https://mariadb.com/docs/server/server-usage/storage-engines/innodb/innodb-row-formats/innodb-row-formats-overview), [InnoDB DYNAMIC Row Format](https://mariadb.com/kb/en/innodb-dynamic-row-format/)

---

## Rollback Strategies

### Forward-Only vs Reversible Migrations

**General Rule:** When reverting database schema changes on live production, it is simpler and safer to **roll forward** (create new migration reversing changes) rather than roll back.

**Benefits of Rolling Forward:**
- Maintains deployment audit trail (important for compliance)
- Safer for production environments
- No risk of missing intermediate state
- Clear history of what happened

Source: [Implementing a roll back strategy - Redgate Flyway](https://documentation.red-gate.com/fd/implementing-a-roll-back-strategy-138347142.html), [Failed Database Deployments: Roll Back or Fix Forward?](https://www.red-gate.com/hub/product-learning/flyway/failed-flyway-database-deployments-roll-back-or-fix-forward)

### Rollback vs Roll Forward

**Rolling Back:**
- Restores previous schema state as if later state never happened
- Only works for non-destructive changes
- Cannot recover from column/table drops without backup
- Complexity increases with data transformations

**Rolling Forward:**
- New deployment that reverses changes from previous deployment
- Maintains audit trail
- Simpler for production
- Clear record of all changes

Source: [Database Rollbacks & Fix Forward in DevOps](https://www.liquibase.com/blog/database-rollbacks-the-devops-approach-to-rolling-back-and-fixing-forward), [Database Rollback Strategies in DevOps](https://www.harness.io/harness-devops-academy/database-rollback-strategies-in-devops)

### Reversible Changesets (Liquibase)

**Capabilities:**
- Changesets can include rollback scripts
- Automated commands can revert changes quickly and consistently
- Every change can have corresponding rollback script

**Limitations:**
- Only works for non-destructive changes
- Doesn't help if dropping column means permanent data loss
- Only recommended for small changesets with straightforward rollback scripts
- Fragile for complex, real-world data transformations

**Important Caveat:**
Rollback scripts are **no substitute for robust backup/restore strategy**. Certain changes (table/column drops) cannot be recovered directly and require backup restoration.

Source: [Liquibase Rollback Workflow](https://docs.liquibase.com/workflows/liquibase-community/using-rollback.html), [Database Rollbacks in CI/CD: Strategies and Pitfalls](https://medium.com/@jasminfluri/database-rollbacks-in-ci-cd-strategies-and-pitfalls-f0ffd4d4741a)

### Backup Strategy

**Critical Requirement:**
Always have a robust backup/restore strategy. Rollback scripts alone are not sufficient.

**Best Practices:**
1. Backup before any structural changes
2. Test backup restoration process
3. Verify backup completeness
4. Document restoration procedures
5. Consider point-in-time recovery capabilities

Source: [Database Rollback Strategies in DevOps](https://www.harness.io/harness-devops-academy/database-rollback-strategies-in-devops)

---

## Migration Ordering and Dependencies

### Flyway Versioned Migration Ordering

**Version Sorting:**
Versions are sorted numerically. Simple zero-padded integers work for most cases.

**Naming Convention:**
`V<version>__<description>.sql`
- Version: Must be unique and sortable
- Description: Informative text
- Checksum: Detects accidental modifications

**Examples:**
- `V001__initial_schema.sql`
- `V002__add_users_table.sql`
- `V003.001__add_email_column.sql`

**Timestamp Approach:**
Flyway Desktop generates timestamps by default to prevent conflicts when multiple team members add migrations simultaneously. Versioning is numeric-only to conform to Flyway engine sorting standards.

Source: [Versioned Migrations - Redgate Flyway](https://documentation.red-gate.com/fd/versioned-migrations-273973333.html)

### Best Practices for Migration Order

**Critical Guideline:**
Never make changes to existing versioned migrations once applied to permanent downstream environment. Instead, create new versioned migration and roll forward.

**Dependency Management:**
1. **Schema before data:** Create tables before inserting data
2. **Indexes after data:** For large datasets, create indexes after data load
3. **Foreign keys last:** Add foreign key constraints after both parent and child tables exist
4. **Drop constraints first:** When dropping tables, remove foreign key constraints first

**Common Use Cases for Versioned Migrations:**
- Schema modifications (tables, indexes, foreign keys, enums)
- Reference data updates
- User data corrections

Source: [Versioned Migrations - Redgate Flyway](https://documentation.red-gate.com/fd/versioned-migrations-273973333.html)

### Liquibase Changeset Ordering

**Execution Order:**
Liquibase reads changesets in order during updates. For rollback, Liquibase rolls back sequentially in reverse order until reaching the target point (e.g., tag row in DATABASECHANGELOG table).

**Dependencies:**
Changesets execute in the order defined in changelog files. Manage dependencies by:
1. Ordering changesets correctly in changelog
2. Using multiple changelog files with includes
3. Leveraging preconditions to verify prerequisites
4. Using contexts and labels for conditional execution

Source: [Liquibase Rollback Workflow](https://docs.liquibase.com/workflows/liquibase-community/using-rollback.html)

---

## Testing Migrations

### Testing Against Production-Size Datasets

**Critical Importance:**
Simulate migrations under production-like volumes to confirm they finish within acceptable time windows.

Source: [Best practices for migrating large MySQL and MariaDB databases](https://docs.aws.amazon.com/prescriptive-guidance/latest/migration-large-mysql-mariadb-databases/best-practices.html)

### Backup and Data Source Strategies

**Use Replicas for Testing:**
If the source server has replicas, dump data from one of the replicas instead of production server.

**Leverage Existing Backups:**
- If backup format is suitable for direct import, use it as input
- If not suitable, provision temporary database from backup and dump data from it

**Minimum Impact Approach:**
If replicas and backups unavailable:
- Perform dumps during **off-peak hours**
- Reduce concurrency of dump operations to maintain spare capacity

Source: [Best practices for migrating large MySQL and MariaDB databases](https://docs.aws.amazon.com/prescriptive-guidance/latest/migration-large-mysql-mariadb-databases/best-practices.html)

### Performance Considerations

**Threading Configuration:**
- **Export:** Use one thread for each CPU core
- **Import:** Use one thread for every two CPU cores

**Avoid Performance Degradation:**
- Ensure sufficient space on source and destination for backup and restore
- **Don't create secondary indexes until migration is complete** - they add maintenance overhead and slow imports significantly

Source: [Best practices for migrating large MySQL and MariaDB databases](https://docs.aws.amazon.com/prescriptive-guidance/latest/migration-large-mysql-mariadb-databases/best-practices.html)

### Validation Strategies

**Pre-Migration:**
- Perform backup of existing data and configurations
- Establish restoration plan
- Test backup viability

**During Migration:**
- Monitor replication lag (if applicable)
- Watch for lock timeouts
- Track migration duration

**Post-Migration:**
- Compare source and target data for accuracy and integrity
- Test functionality and performance of applications
- Create detailed data mapping document
- Automate reconciliation scripts for large datasets

**Phased Testing:**
Break testing into phases:
1. Migrate one business unit, region, or dataset first
2. Validate thoroughly
3. Fix issues
4. Scale up to full dataset

Source: [Best practices for migrating large MySQL and MariaDB databases](https://docs.aws.amazon.com/prescriptive-guidance/latest/migration-large-mysql-mariadb-databases/best-practices.html), [Data Migration Testing Guide](https://datalark.com/blog/data-migration-testing-guide)

### Server Validation

**Best Practices:**
- Validate servers before exposure to production workloads
- Prevent access to unconfigured servers until validated
- Confirm configuration matches requirements
- Test under production-like load

Source: [Best Practices - Testing](https://mariadb.com/docs/deploy/best-practices/testing/)

---

## Quick Reference Tables

### ALTER TABLE Algorithm Support Matrix

| Operation | INSTANT | NOCOPY | INPLACE | COPY | Lock Type |
|-----------|---------|--------|---------|------|-----------|
| ADD COLUMN (end, 10.3.2+) | ✓ | ✓ | ✓ | ✓ | NONE |
| ADD COLUMN (any position, 10.4+) | ✓ | ✓ | ✓ | ✓ | NONE |
| DROP COLUMN (10.4+) | ✓ | ✓ | ✓ | ✓ | NONE |
| ADD INDEX (plain) | ✗ | ✓ | ✓ | ✓ | NONE |
| ADD FULLTEXT INDEX | ✗ | Limited | ✓ | ✓ | SHARED |
| ADD SPATIAL INDEX | ✗ | ✓ | ✓ | ✓ | SHARED |
| DROP INDEX | ✓ | ✓ | ✓ | ✓ | NONE |
| ADD FOREIGN KEY | ✗ | ✓* | ✓* | ✓ | NONE* |
| DROP FOREIGN KEY | ✓ | ✓ | ✓ | ✓ | NONE |
| RENAME COLUMN | ✓ | ✓ | ✓ | ✓ | EXCLUSIVE |
| ALTER COLUMN DEFAULT | ✓ | ✓ | ✓ | ✓ | NONE |
| RENAME TABLE | ✓ | ✓ | ✓ | ✓ | EXCLUSIVE |
| CHANGE ROW_FORMAT | ✗ | ✗ | ✓ | ✓ | NONE |

*Requires `foreign_key_checks=OFF`

### Migration Tool Comparison

| Feature | Flyway | Liquibase | pt-online-schema-change | gh-ost |
|---------|--------|-----------|------------------------|--------|
| **Versioned Migrations** | ✓ | ✓ | ✗ | ✗ |
| **Rollback Support** | Limited | ✓ | ✗ | ✗ |
| **MariaDB Support** | ✓ | ✓ | ✓ | ✓ |
| **Foreign Keys** | ✓ | ✓ | Limited | ✗ |
| **Galera Cluster** | ✓ | ✓ | ✓ | ✗ |
| **Zero Downtime** | Depends | Depends | ✓ | ✓ |
| **Triggers** | ✓ | ✓ | Uses | ✗ |
| **Pausable** | ✗ | ✗ | Limited | ✓ |
| **Speed** | N/A | N/A | Slow | Slow |

---

## Additional Resources

### Official Documentation

- [MariaDB Knowledge Base](https://mariadb.com/kb/en/)
- [Redgate Flyway Documentation](https://documentation.red-gate.com/flyway)
- [Liquibase Documentation](https://docs.liquibase.com/)
- [Percona Toolkit Documentation](https://www.percona.com/doc/percona-toolkit/)
- [gh-ost Documentation](https://github.com/github/gh-ost)

### Key Articles

- [Reduced operational downtime with new ALTER TABLE features](https://mariadb.com/resources/blog/reduced-operational-downtime-with-new-alter-table-features/)
- [Online Schema Change for MySQL & MariaDB - Comparing gh-ost vs pt-online-schema-change](https://severalnines.com/blog/online-schema-change-mysql-mariadb-comparing-github-s-gh-ost-vs-pt-online-schema-change/)
- [Best practices for migrating large MySQL and MariaDB databases](https://docs.aws.amazon.com/prescriptive-guidance/latest/migration-large-mysql-mariadb-databases/best-practices.html)

---

*Document Version: 1.0*  
*Last Updated: 2026-02-17*  
*Compiled from official MariaDB, Flyway, and Liquibase documentation*
