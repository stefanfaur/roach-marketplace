# MariaDB Performance Tuning Reference

A comprehensive guide to MariaDB performance optimization covering buffer pool configuration, thread management, query logging, monitoring metrics, and application-side connection pooling.

## Table of Contents

- [InnoDB Buffer Pool Configuration](#innodb-buffer-pool-configuration)
- [Thread Pool Configuration](#thread-pool-configuration)
- [Slow Query Log Setup](#slow-query-log-setup)
- [Performance Monitoring Metrics](#performance-monitoring-metrics)
- [Performance Schema](#performance-schema)
- [Transaction and Process Analysis](#transaction-and-process-analysis)
- [Query Optimizer Statistics](#query-optimizer-statistics)
- [InnoDB Redo Log Configuration](#innodb-redo-log-configuration)
- [Memory Buffer Configuration](#memory-buffer-configuration)
- [Application Connection Pooling](#application-connection-pooling)

---

## InnoDB Buffer Pool Configuration

### Buffer Pool Sizing

The InnoDB buffer pool is the most critical memory allocation for database performance. It caches table and index data to reduce disk I/O.

#### Rule of Thumb

**For dedicated database servers**: Set `innodb_buffer_pool_size` to **70-80% of available RAM**.

Source: [InnoDB Buffer Pool | MariaDB Documentation](https://mariadb.com/docs/server/server-usage/storage-engines/innodb/innodb-buffer-pool)

#### Sizing Guidelines

- **Minimum size**: 6 MB (approximately 320 pages at default 16KB page size)
- **Starting point**: Several gigabytes of memory is a good starting point if available
- **Critical principle**: Ensure the buffer pool contains most of your active dataset
- **Avoid oversizing**: Do not allocate so much memory that the system starts swapping

#### Configuration

```ini
[mysqld]
# For a dedicated server with 32GB RAM
innodb_buffer_pool_size = 24G  # 75% of 32GB
```

#### Dynamic Resizing

The buffer pool size can be adjusted without server restart (MariaDB 10.11.12+):

```sql
SET GLOBAL innodb_buffer_pool_size = 25769803776;  -- 24GB in bytes
```

#### Warm-up Optimization

```ini
[mysqld]
innodb_buffer_pool_dump_at_shutdown = 1
innodb_buffer_pool_load_at_startup = 1
```

Source: [InnoDB Buffer Pool | MariaDB Documentation](https://mariadb.com/docs/server/server-usage/storage-engines/innodb/innodb-buffer-pool)

### Buffer Pool Instances

Multiple buffer pool instances reduce contention in high-concurrency environments.

```ini
[mysqld]
innodb_buffer_pool_size = 12G
innodb_buffer_pool_instances = 12  # 1GB per instance
```

**Prerequisites:**
- Buffer pool size must be **>= 1GB** for multiple instances
- Each instance should be **at least 1GB**

**Important:** `innodb_buffer_pool_instances` was **deprecated in MariaDB 10.5.1 and removed in MariaDB 10.6.0**.

Source: [InnoDB System Variables | MariaDB Documentation](https://mariadb.com/docs/server/server-usage/storage-engines/innodb/innodb-system-variables)

### Buffer Pool Hit Ratio Monitoring

Monitor two critical status variables:

- **`Innodb_buffer_pool_read_requests`**: Total read requests
- **`Innodb_buffer_pool_reads`**: Actual disk reads (cache misses)

```sql
SHOW GLOBAL STATUS LIKE 'Innodb_buffer_pool_read%';
```

**Target**: The change in `Innodb_buffer_pool_reads` should be less than 1% of the change in `Innodb_buffer_pool_read_requests` over a one-minute interval.

If `innodb_buffer_pool_wait_free` increases, the buffer pool is undersized.

Source: [InnoDB Buffer Pool | MariaDB Documentation](https://mariadb.com/docs/server/server-usage/storage-engines/innodb/innodb-buffer-pool)

---

## Thread Pool Configuration

### Overview

The thread pool improves concurrency by managing client connections more efficiently than the traditional one-thread-per-connection model.

### thread_handling

Controls the threading model:

| Value | Description |
|-------|-------------|
| `one-thread-per-connection` | Default — one thread per client |
| `pool-of-threads` | Thread pool for client connections |
| `no-threads` | Single thread for all connections (debugging only) |

```ini
[mysqld]
thread_handling = pool-of-threads
```

### thread_pool_size

**Default**: Auto-sized to the number of CPU cores.

The goal is to have one running thread on each CPU at a time. On Unix, the MariaDB thread pool normally needs no configuration because it auto-configures to the number of CPU cores.

```ini
[mysqld]
thread_pool_size = 8  # Explicitly set (usually unnecessary on Unix)
```

Source: [Thread Pool in MariaDB | MariaDB Documentation](https://mariadb.com/kb/en/thread-pool-in-mariadb/)

---

## Slow Query Log Setup

### Enabling the Slow Query Log

```ini
[mysqld]
slow_query_log = 1
slow_query_log_file = /var/log/mysql/slow-queries.log
long_query_time = 2.0  # Queries taking longer than 2 seconds
```

Or enable dynamically:

```sql
SET GLOBAL slow_query_log = 1;
SET GLOBAL long_query_time = 2.0;
```

Source: [Slow Query Log Overview | MariaDB Documentation](https://mariadb.com/docs/server/server-management/server-monitoring-logs/slow-query-log/slow-query-log-overview)

### long_query_time

Defines a slow query in seconds (supports microseconds).

- **Default**: 10 seconds
- **Recommended**: 1-5 seconds depending on workload

### log_slow_rate_limit

Throttles slow query logging by recording only 1 out of every N queries:

```ini
[mysqld]
log_slow_rate_limit = 5  # Log 1 out of every 5 slow queries
```

### log_slow_filter

Filter which types of slow queries to log:

```ini
[mysqld]
log_slow_filter = filesort,filesort_on_disk,tmp_table,tmp_table_on_disk
```

Options: `admin`, `filesort`, `filesort_on_disk`, `full_join`, `full_scan`, `query_cache`, `query_cache_miss`, `tmp_table`, `tmp_table_on_disk`

### Complete Configuration

```ini
[mysqld]
log_output = FILE
slow_query_log = 1
slow_query_log_file = /var/log/mysql/slow-queries.log
long_query_time = 2.0
log_slow_rate_limit = 5
log_slow_filter = filesort,filesort_on_disk,tmp_table,tmp_table_on_disk
```

Source: [Slow Query Log Overview | MariaDB Documentation](https://mariadb.com/docs/server/server-management/server-monitoring-logs/slow-query-log/slow-query-log-overview)

---

## Performance Monitoring Metrics

### Key SHOW GLOBAL STATUS Metrics

#### Buffer Pool Hit Ratio

```sql
SHOW GLOBAL STATUS LIKE 'Innodb_buffer_pool_read%';
```

**Calculation**: `Hit Ratio = 1 - (Innodb_buffer_pool_reads / Innodb_buffer_pool_read_requests)`

**Target**: > 99% hit ratio

Source: [InnoDB Server Status Variables | MariaDB Documentation](https://mariadb.com/kb/en/innodb-status-variables/)

#### Thread Metrics

**Threads_running** — Client connections actively running a command (not sleeping).

```sql
SHOW GLOBAL STATUS LIKE 'Threads_running';
```

High values (> number of CPU cores) indicate potential bottlenecks.

**Threads_connected** — Total currently open connections.

```sql
SHOW GLOBAL STATUS LIKE 'Threads_connected';
```

Compare against `max_connections` limit.

Source: [Server Status Variables | MariaDB Documentation](https://mariadb.com/docs/server/server-management/variables-and-modes/server-status-variables)

#### Slow_queries

Number of queries exceeding `long_query_time`. The slow query log does not need to be active for this counter.

```sql
SHOW GLOBAL STATUS LIKE 'Slow_queries';
```

### SHOW ENGINE INNODB STATUS

```sql
SHOW ENGINE INNODB STATUS\G
```

**Key Sections**: Buffer Pool and Memory, Row Operations, Transaction Information, I/O Activity.

Source: [SHOW ENGINE INNODB STATUS | MariaDB Documentation](https://mariadb.com/docs/server/reference/sql-statements/administrative-sql-statements/show/show-engine-innodb-status)

---

## Performance Schema

### Activation

Must be enabled at server startup (cannot be activated at runtime):

```ini
[mysqld]
performance_schema = ON
```

Source: [Performance Schema Overview | MariaDB Documentation](https://mariadb.com/docs/server/reference/system-tables/performance-schema/performance-schema-overview)

### Key Configuration Tables

```sql
-- Enable statement consumers
UPDATE performance_schema.setup_consumers
SET ENABLED = 'YES'
WHERE NAME LIKE 'events_statements_%';

-- Configure instruments
UPDATE performance_schema.setup_instruments
SET ENABLED = 'YES', TIMED = 'YES'
WHERE NAME LIKE 'statement/%';
```

### Key Monitoring Queries

#### Top Slow Queries by Digest

```sql
SELECT schema_name,
       DIGEST_TEXT,
       COUNT_STAR AS exec_count,
       AVG_TIMER_WAIT/1000000000000 AS avg_seconds,
       SUM_ROWS_EXAMINED,
       SUM_ROWS_SENT
FROM performance_schema.events_statements_summary_by_digest
ORDER BY SUM_TIMER_WAIT DESC
LIMIT 10;
```

Source: [Performance Schema events_statements_summary_by_digest Table | MariaDB Documentation](https://mariadb.com/kb/en/performance-schema-events_statements_summary_by_digest-table/)

#### Current Statements

```sql
SELECT THREAD_ID, SQL_TEXT, TIMER_WAIT/1000000000000 AS seconds
FROM performance_schema.events_statements_current
WHERE SQL_TEXT IS NOT NULL;
```

Source: [Performance Schema events_statements_current Table | MariaDB Documentation](https://mariadb.com/kb/en/performance-schema-events_statements_current-table/)

---

## Transaction and Process Analysis

### SHOW PROCESSLIST

```sql
SHOW FULL PROCESSLIST;
```

Use to identify long-running queries, locked queries, and idle connections.

Source: [SHOW PROCESSLIST | MariaDB Documentation](https://mariadb.com/docs/server/reference/sql-statements/administrative-sql-statements/show/show-processlist)

### INFORMATION_SCHEMA.INNODB_TRX

Find long-running transactions:

```sql
SELECT trx_id,
       trx_state,
       trx_started,
       TIMESTAMPDIFF(SECOND, trx_started, NOW()) AS running_seconds,
       trx_mysql_thread_id,
       trx_query,
       trx_rows_locked,
       trx_tables_locked
FROM INFORMATION_SCHEMA.INNODB_TRX
WHERE TIMESTAMPDIFF(SECOND, trx_started, NOW()) > 60
ORDER BY trx_started;
```

**Key Columns**: `trx_started`, `trx_state` (RUNNING, LOCK WAIT, ROLLING BACK, COMMITTING), `trx_rows_locked`, `trx_tables_locked`.

#### Joining PROCESSLIST and INNODB_TRX

```sql
SELECT p.id, p.user, p.host, p.db, p.time, p.state,
       t.trx_id, t.trx_state, t.trx_started, t.trx_rows_locked
FROM INFORMATION_SCHEMA.PROCESSLIST p
JOIN INFORMATION_SCHEMA.INNODB_TRX t ON p.id = t.trx_mysql_thread_id
ORDER BY p.time DESC;
```

Source: [Information Schema INNODB_TRX Table | MariaDB Documentation](https://mariadb.com/kb/en/information-schema-innodb_trx-table/)

---

## Query Optimizer Statistics

### ANALYZE TABLE

Analyzes and stores the key distribution for a table (index statistics). Updates optimizer statistics used to choose execution plans.

```sql
ANALYZE TABLE orders;
ANALYZE TABLE customers PERSISTENT FOR COLUMNS (customer_id, email, country);
```

#### When to Run

- Tables newly populated with data
- Tables receiving new columns used in WHERE clauses
- Tables that have doubled in size
- When queries become slow due to changed join order
- When data distribution changes significantly

**Supported engines**: MyISAM, Aria, InnoDB.

During analysis InnoDB permits concurrent reads and writes.

Source: [ANALYZE TABLE | MariaDB Documentation](https://mariadb.com/docs/server/reference/sql-statements/table-statements/analyze-table)

---

## InnoDB Redo Log Configuration

### innodb_flush_log_at_trx_commit

Controls how frequently the InnoDB redo log is flushed after transactions.

| Value | Behavior | Use Case |
|-------|----------|----------|
| `1` (default) | Log flushed after each transaction | Full ACID compliance |
| `0` | Log flushed once per second | Best performance, up to 1s loss on crash |
| `2` | Log written after commit, flushed per second | Balanced for battery-backed cache |

**Recommendation**: Set to `1` with `sync_binlog=1` for maximum durability.

```ini
[mysqld]
innodb_flush_log_at_trx_commit = 1
sync_binlog = 1
```

Source: [InnoDB System Variables | MariaDB Documentation](https://mariadb.com/docs/server/server-usage/storage-engines/innodb/innodb-system-variables)

### innodb_log_file_size

Size of each InnoDB redo log file.

**Guideline**: Set combined total to **at least 1/4 (or 1/2) of the InnoDB buffer pool size**, or equal to one hour's worth of log entries during peak load.

- **Larger logs**: Reduce checkpoints, improve disk I/O, slower crash recovery
- **Smaller logs**: More frequent checkpoints, faster crash recovery, more disk I/O

```ini
[mysqld]
# For a 24GB buffer pool
innodb_log_file_size = 6G  # 1/4 of buffer pool
```

**Dynamic Resizing**: Available from MariaDB 10.5+. Before MariaDB 10.9, resizing required restart.

Source: [InnoDB Redo Log | MariaDB Documentation](https://mariadb.com/docs/server/server-usage/storage-engines/innodb/innodb-redo-log)

---

## Memory Buffer Configuration

### tmp_table_size and max_heap_table_size

Control the maximum size of internal in-memory temporary tables. The smaller of the two limits applies.

- **Default**: 64MB (recent versions)
- **Recommendation**: Start with 32M to 64M, tune as needed
- **Scope**: Per-connection

```ini
[mysqld]
tmp_table_size = 64M
max_heap_table_size = 64M
```

Monitor disk temporary tables:

```sql
SHOW GLOBAL STATUS LIKE 'Created_tmp%';
```

Minimize `Created_tmp_disk_tables` relative to `Created_tmp_tables`.

Source: [MariaDB Memory Allocation | MariaDB Documentation](https://mariadb.com/docs/server/ha-and-performance/mariadb-memory-allocation)

### join_buffer_size

Buffer for queries that cannot use an index and perform full table scans.

- **Default**: 256KB
- **Recommendation**: Keep low globally, set high per-session for large joins

```sql
SET SESSION join_buffer_size = 4194304;  -- 4MB for specific session
```

Source: [Server System Variables | MariaDB Documentation](https://mariadb.com/docs/server/server-management/variables-and-modes/server-system-variables)

### sort_buffer_size

Each thread performing a sort allocates this buffer. Allocated per connection, so keep reasonable.

```ini
[mysqld]
sort_buffer_size = 2M  # Conservative global setting
```

Source: [MariaDB Memory Allocation | MariaDB Documentation](https://mariadb.com/docs/server/ha-and-performance/mariadb-memory-allocation)

---

## Application Connection Pooling

### HikariCP Configuration

HikariCP is the recommended high-performance JDBC connection pool for Java applications.

#### Default Settings

| Setting | Default |
|---------|---------|
| Maximum pool size | 10 |
| Minimum idle | Same as max pool size |
| Connection timeout | 30,000 ms (30 seconds) |
| Idle timeout | 600,000 ms (10 minutes) |
| Max lifetime | 1,800,000 ms (30 minutes) |

#### Recommended Pool Size Formula

```
connections = ((core_count x 2) + effective_spindle_count)
```

- **core_count**: CPU cores (excluding hyperthreading)
- **effective_spindle_count**: 0 if data fully cached, ~1 for single SSD/HDD

Example: 4-core server with one drive = `((4 x 2) + 1) = 9 ~ 10 connections`

#### Core Principles

**Small pools perform better.** Reducing pool size from 2,048 to 96 connections improved response times by over 50x in real-world tests. Once threads exceed CPU cores, adding more threads makes things slower.

**Best practice**: Small pool, saturated with threads waiting for connections.

Source: [About Pool Sizing | HikariCP Wiki](https://github.com/brettwooldridge/HikariCP/wiki/About-Pool-Sizing)

#### Configuration Example

```java
HikariConfig config = new HikariConfig();
config.setJdbcUrl("jdbc:mariadb://localhost:3306/mydb");
config.setUsername("user");
config.setPassword("password");
config.setMaximumPoolSize(10);
config.setMinimumIdle(10);

HikariDataSource ds = new HikariDataSource(config);
```

#### Avoiding Connection Pool Deadlock

For threads holding multiple connections:

```
pool_size = Tn x (Cm - 1) + 1
```

- **Tn**: Maximum number of threads
- **Cm**: Maximum simultaneous connections per thread

Source: [About Pool Sizing | HikariCP Wiki](https://github.com/brettwooldridge/HikariCP/wiki/About-Pool-Sizing)

---

## Summary: Essential Configuration

```ini
[mysqld]
# Buffer Pool (70-80% of RAM for dedicated servers)
innodb_buffer_pool_size = 24G
innodb_buffer_pool_dump_at_shutdown = 1
innodb_buffer_pool_load_at_startup = 1

# Thread Pool
thread_handling = pool-of-threads

# Redo Log (1/4 to 1/2 of buffer pool)
innodb_log_file_size = 6G
innodb_flush_log_at_trx_commit = 1

# Slow Query Log
slow_query_log = 1
long_query_time = 2.0
log_slow_filter = filesort,tmp_table,tmp_table_on_disk

# Memory Buffers
tmp_table_size = 64M
max_heap_table_size = 64M
join_buffer_size = 256K
sort_buffer_size = 2M

# Performance Schema
performance_schema = ON
```

## Summary: Monitoring Commands

```sql
-- Buffer pool hit ratio
SHOW GLOBAL STATUS LIKE 'Innodb_buffer_pool_read%';

-- Thread activity
SHOW GLOBAL STATUS LIKE 'Threads%';

-- Slow queries
SHOW GLOBAL STATUS LIKE 'Slow_queries';

-- Temporary tables
SHOW GLOBAL STATUS LIKE 'Created_tmp%';

-- Current processes
SHOW FULL PROCESSLIST;

-- Long transactions
SELECT * FROM INFORMATION_SCHEMA.INNODB_TRX
WHERE TIMESTAMPDIFF(SECOND, trx_started, NOW()) > 60;

-- Top slow queries (Performance Schema)
SELECT schema_name, DIGEST_TEXT, COUNT_STAR,
       AVG_TIMER_WAIT/1000000000000 AS avg_seconds
FROM performance_schema.events_statements_summary_by_digest
ORDER BY SUM_TIMER_WAIT DESC LIMIT 10;

-- InnoDB status
SHOW ENGINE INNODB STATUS\G
```

---

## Sources

- [InnoDB Buffer Pool | MariaDB Documentation](https://mariadb.com/docs/server/server-usage/storage-engines/innodb/innodb-buffer-pool)
- [InnoDB System Variables | MariaDB Documentation](https://mariadb.com/docs/server/server-usage/storage-engines/innodb/innodb-system-variables)
- [Thread Pool in MariaDB | MariaDB Documentation](https://mariadb.com/kb/en/thread-pool-in-mariadb/)
- [Slow Query Log Overview | MariaDB Documentation](https://mariadb.com/docs/server/server-management/server-monitoring-logs/slow-query-log/slow-query-log-overview)
- [Server Status Variables | MariaDB Documentation](https://mariadb.com/docs/server/server-management/variables-and-modes/server-status-variables)
- [InnoDB Server Status Variables | MariaDB Documentation](https://mariadb.com/kb/en/innodb-status-variables/)
- [Performance Schema Overview | MariaDB Documentation](https://mariadb.com/docs/server/reference/system-tables/performance-schema/performance-schema-overview)
- [SHOW ENGINE INNODB STATUS | MariaDB Documentation](https://mariadb.com/docs/server/reference/sql-statements/administrative-sql-statements/show/show-engine-innodb-status)
- [SHOW PROCESSLIST | MariaDB Documentation](https://mariadb.com/docs/server/reference/sql-statements/administrative-sql-statements/show/show-processlist)
- [Information Schema INNODB_TRX Table | MariaDB Documentation](https://mariadb.com/kb/en/information-schema-innodb_trx-table/)
- [ANALYZE TABLE | MariaDB Documentation](https://mariadb.com/docs/server/reference/sql-statements/table-statements/analyze-table)
- [InnoDB Redo Log | MariaDB Documentation](https://mariadb.com/docs/server/server-usage/storage-engines/innodb/innodb-redo-log)
- [MariaDB Memory Allocation | MariaDB Documentation](https://mariadb.com/docs/server/ha-and-performance/mariadb-memory-allocation)
- [Server System Variables | MariaDB Documentation](https://mariadb.com/docs/server/server-management/variables-and-modes/server-system-variables)
- [About Pool Sizing | HikariCP Wiki](https://github.com/brettwooldridge/HikariCP/wiki/About-Pool-Sizing)

---

*Document compiled from official MariaDB documentation and HikariCP wiki — February 2026*
