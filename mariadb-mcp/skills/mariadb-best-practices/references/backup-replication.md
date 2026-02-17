# MariaDB Backup and Replication Reference Document

Based on my comprehensive research of official MariaDB documentation, I've compiled a detailed reference document covering all the topics you requested. Here is the complete markdown content that should be saved to:

**`/Users/stefanfaur/Desktop/work/ai-tools/roach-marketplace/mariadb-mcp/skills/mariadb-best-practices/references/backup-replication.md`**

Since I don't have direct file writing capabilities in this environment, I'll provide you with the complete document content. You can either:
1. Copy this content and save it manually to the file path
2. Use a text editor to create the file
3. Use a shell command to create it

Here is the complete, comprehensive markdown document:

---

```markdown
# MariaDB Backup and Replication Reference

This document provides comprehensive guidance on MariaDB backup strategies, replication configurations, and high-availability patterns based on official MariaDB documentation.

## Table of Contents

- [Physical Backups with mariadb-backup](#physical-backups-with-mariadb-backup)
- [Logical Backups with mariadb-dump](#logical-backups-with-mariadb-dump)
- [Point-in-Time Recovery](#point-in-time-recovery)
- [Binary Log Management](#binary-log-management)
- [GTID-Based Replication](#gtid-based-replication)
- [Semi-Synchronous Replication](#semi-synchronous-replication)
- [MariaDB Galera Cluster](#mariadb-galera-cluster)
- [MariaDB MaxScale Proxy](#mariadb-maxscale-proxy)
- [Failover Patterns](#failover-patterns)
- [Replication Filters](#replication-filters)
- [Backup Verification Strategies](#backup-verification-strategies)

---

## Physical Backups with mariadb-backup

### Overview

**mariadb-backup** (formerly mariabackup) is an open-source physical backup utility that provides "a production-quality, nearly non-blocking method for performing full backups on running systems." It was originally derived from Percona XtraBackup 2.3.8 and supports InnoDB, Aria, MyISAM, and MyRocks storage engines.

**Key Features:**
- Hot online backups for InnoDB tables
- Support for Data-at-Rest Encryption
- InnoDB Page Compression support
- Integration with Galera Cluster via SST method
- Point-in-time recovery capabilities
- Significantly faster than logical backups for large databases

**Source:** [mariadb-backup Overview](https://mariadb.com/kb/en/mariabackup-overview/)

### When to Use Physical vs Logical Backups

**Use mariadb-backup when:**
- Working with large databases (significantly faster)
- Minimal locking during backup is required
- Non-blocking InnoDB operations are essential
- Native encryption and compression support is needed
- Point-in-time recovery is planned

**Use mariadb-dump when:**
- Backing up individual tables or selective data
- Cross-platform or cross-version portability is needed
- Database size is small to medium
- SQL-level backup representation is preferred

**Sources:** 
- [mariadb-backup Overview](https://mariadb.com/kb/en/mariabackup-overview/)
- [Making Backups with mariadb-dump](https://mariadb.com/kb/en/making-backups-with-mariadb-dump/)

### Full Backup with mariadb-backup

**Required Privileges:**

```sql
GRANT RELOAD, PROCESS, LOCK TABLES, BINLOG MONITOR ON *.* TO 'mariadb-backup'@'localhost';
```

**Source:** [mariadb-backup Overview](https://mariadb.com/kb/en/mariabackup-overview/)

**Backup Command:**

```bash
mariadb-backup --backup --target-dir=/var/mariadb/backup/ \
   --user=mariadb-backup --password=mypassword
```

**Key Requirements:**
- Target directory must be empty or non-existent
- Tool automatically creates the directory if it doesn't exist

**Source:** [Full Backup and Restore with mariadb-backup](https://mariadb.com/kb/en/full-backup-and-restore-with-mariabackup/)

**Optional History Tracking:**

```bash
mariadb-backup --backup --target-dir=/var/mariadb/backup/ \
   --user=mariadb-backup --password=mypassword \
   --history=full_backup_weekly
```

Backup user requires `INSERT`, `CREATE`, and `ALTER` privileges on the history table.

**History Tables:**
- **MariaDB 10.11+:** `mysql.mariadb_backup_history` (InnoDB, transactional)
- **MariaDB 10.10 and earlier:** `PERCONA_SCHEMA.xtrabackup_history` (CSV)

**Source:** [mariadb-backup Overview](https://mariadb.com/kb/en/mariabackup-overview/)

**Preparation Phase:**

Before restoration, data consistency must be established:

```bash
mariadb-backup --prepare --target-dir=/var/mariadb/backup/
```

**Critical Note:** You must use a version of mariadb-backup that is compatible with the server version.

**Source:** [Full Backup and Restore with mariadb-backup](https://mariadb.com/kb/en/full-backup-and-restore-with-mariabackup/)

**Restoration Steps:**

1. Stop the MariaDB Server process
2. Verify the datadir is empty
3. Execute restoration:

```bash
mariadb-backup --copy-back --target-dir=/var/mariadb/backup/
```

4. Adjust file ownership (typically needed):

```bash
chown -R mysql:mysql /var/lib/mysql/
```

5. Restart MariaDB Server

**Source:** [Full Backup and Restore with mariadb-backup](https://mariadb.com/kb/en/full-backup-and-restore-with-mariabackup/)

### Incremental Backups

**How They Work:**

Incremental backups update a previous backup with new data rather than creating a complete copy. The system tracks changes using Log Sequence Numbers (LSNs) stored in InnoDB pages. "Whenever you modify a row on any InnoDB table on the database, the storage engine increments this number."

**Source:** [Incremental Backup and Restore with mariadb-backup](https://mariadb.com/kb/en/incremental-backup-and-restore-with-mariabackup/)

**Step 1: Full Backup (Required First)**

```bash
mariadb-backup --backup --target-dir=/var/mariadb/backup/ \
  --user=mariadb-backup --password=mypassword
```

**Step 2: First Incremental Backup**

```bash
mariadb-backup --backup --target-dir=/var/mariadb/inc1/ \
  --incremental-basedir=/var/mariadb/backup/ \
  --user=mariadb-backup --password=mypassword
```

**Step 3: Additional Incremental Backups**

Chain multiple increments by using each incremental backup's directory as the base for the next one:

```bash
mariadb-backup --backup --target-dir=/var/mariadb/inc2/ \
  --incremental-basedir=/var/mariadb/inc1/ \
  --user=mariadb-backup --password=mypassword
```

**Source:** [Incremental Backup and Restore with mariadb-backup](https://mariadb.com/kb/en/incremental-backup-and-restore-with-mariabackup/)

**Restoration Process:**

1. Prepare the base backup, then apply each incremental backup sequentially using `--prepare`
2. Stop MariaDB and empty the datadir
3. Restore using `--copy-back` (preserves originals) or `--move-back` (moves files)
4. Adjust file ownership to the MariaDB user (typically `mysql`)
5. Restart MariaDB

**Source:** [Incremental Backup and Restore with mariadb-backup](https://mariadb.com/kb/en/incremental-backup-and-restore-with-mariabackup/)

**Best Practices:**

- Under normal operation, incremental backup shortens the amount of time mariadb-backup locks the server while copying tablespaces
- You can apply the changes in the increment to the full backup with a `--prepare` operation at leisure
- To expedite recovery, incremental backups can be pre-applied to the prior full backup to enable faster recovery
- Use the `--history` option to reference backups by logical names instead of paths

**Sources:**
- [Incremental Backup and Restore with mariadb-backup](https://mariadb.com/kb/en/incremental-backup-and-restore-with-mariabackup/)
- [mariadb-backup Options](https://mariadb.com/kb/en/mariabackup-options/)

### Important Limitations

**Silent Option Ignorance:** A critical caveat: "mariadb-backup will currently silently ignore unknown command-line options." Typos in options won't trigger error messages, potentially causing unintended behavior.

**Open Files Limit:** Large backups may exceed system file descriptor limits, causing "Too many open files" errors. Solutions:
- Use the `--open-files-limit` option
- Adjust system limits in `/etc/security/limits.conf`

**Encryption Considerations:** Encryption/decryption problems may not surface until the backup preparation phase, as most encryption operations occur then rather than during initial backup capture.

**Source:** [mariadb-backup Overview](https://mariadb.com/kb/en/mariabackup-overview/)

---

## Logical Backups with mariadb-dump

### Overview

`mariadb-dump` is "a command-line utility included with MariaDB for creating logical backups of your databases." It generates SQL statement files that can reconstruct databases and their contents, allowing backups without server shutdown.

**Source:** [Making Backups with mariadb-dump](https://mariadb.com/kb/en/making-backups-with-mariadb-dump/)

### When to Use mariadb-dump

**Ideal Scenarios:**
- Large databases where backing up individual tables is more efficient than entire databases
- Databases where only certain tables change regularly, allowing selective backups
- InnoDB environments using `--single-transaction` for consistent snapshots without prolonged table locking
- Different backup schedules for different databases
- Cross-platform or cross-version portability requirements

**Source:** [Making Backups with mariadb-dump](https://mariadb.com/kb/en/making-backups-with-mariadb-dump/)

### Essential Command Examples

**All Databases:**

```bash
mariadb-dump --user=admin_backup --password --lock-tables --all-databases > backup.sql
```

**Single Database:**

```bash
mariadb-dump --user=admin_backup --password --lock-tables --extended-insert --databases db_name > backup.sql
```

**Specific Tables:**

```bash
mariadb-dump --user=admin_backup --password --lock-tables your_database table1 table2 > backup.sql
```

**Source:** [Making Backups with mariadb-dump](https://mariadb.com/kb/en/making-backups-with-mariadb-dump/)

### Best Practices

- Use `--extended-insert` for smaller files and faster restoration
- Employ `--single-transaction` for InnoDB tables instead of `--lock-tables`
- Test backup files by restoring to non-production environments
- Restrict script file permissions if passwords are included
- Store backups securely

**Sources:**
- [Making Backups with mariadb-dump](https://mariadb.com/kb/en/making-backups-with-mariadb-dump/)
- [mysqldump](https://mariadb.com/kb/en/mysqldump/)

---

## Point-in-Time Recovery

### Overview

Point-in-time recovery (PITR) uses binary logs to restore a database to a specific moment in time. The `mariadb-binlog` utility (formerly `mysqlbinlog`) converts binary log files into human-readable text format for reapplication.

"The MariaDB server's binary log is a set of files containing 'events' which represent modifications to the contents of a MariaDB database."

**Source:** [Using mariadb-binlog](https://mariadb.com/kb/en/using-mariadb-binlog/)

### Basic Command Syntax

**Display a Binary Log File:**

```bash
mariadb-binlog mariadb-bin.000152
```

**Single Log File Recovery:**

```bash
mariadb-binlog binlog-filename | mysql -u root -p
```

**Source:** [Using mariadb-binlog](https://mariadb.com/kb/en/using-mariadb-binlog/)

### Safe Recovery with Editing

Extract the log to a file for review before applying:

```bash
mariadb-binlog -r outputfile binlog-filename
mariadb -u root -p --binary-mode < outputfile
```

This allows you to remove unwanted statements (like accidental `DROP DATABASE` commands) before execution.

**Source:** [Using mariadb-binlog](https://mariadb.com/kb/en/using-mariadb-binlog/)

### Multiple Log Files

Process several logs in one connection to preserve temporary tables:

```bash
mariadb-binlog mariadb-bin.000001 mariadb-bin.000002 | mariadb -u root -p --binary-mode
```

For manual editing of multiple logs, combine them first, then execute as a single transaction to maintain data integrity across related operations.

**Source:** [Using mariadb-binlog](https://mariadb.com/kb/en/using-mariadb-binlog/)

### Flashback Feature

The real work of Flashback is done by mariadb-binlog with `--flashback`, which causes events to be translated:
- `INSERT` to `DELETE`
- `DELETE` to `INSERT`
- For `UPDATE` statements, the before and after images are swapped

**Source:** [Flashback](https://mariadb.com/kb/en/flashback/)

---

## Binary Log Management

### Retention Configuration

**expire_logs_days:**

Set to 0 by default (no automatic deletion). Configure with a number of days after which binary log files are automatically removed.

**Important:** "Always set expire_logs_days higher than any possible replica lag."

**Source:** [Using and Maintaining the Binary Log](https://mariadb.com/kb/en/using-and-maintaining-the-binary-log/)

**binlog_expire_logs_seconds:**

Available in MariaDB 10.6+, this variable provides more granular control over log deletion and takes precedence when both variables are non-zero.

**Source:** [Using and Maintaining the Binary Log](https://mariadb.com/kb/en/using-and-maintaining-the-binary-log/)

**max_binlog_total_size:**

Available in MariaDB 11.4+, allows you to cap the total combined size of all binary logs.

**Source:** [Using and Maintaining the Binary Log](https://mariadb.com/kb/en/using-and-maintaining-the-binary-log/)

### Purging Strategies

**Three Primary Methods:**

1. **RESET MASTER** - Deletes all binary logs on the server
2. **PURGE BINARY LOGS** - Removes logs before a specific datetime or up to a numbered file
3. **Automatic expiration** - Based on age thresholds via configuration variables

**Source:** [PURGE BINARY LOGS](https://mariadb.com/kb/en/purge-binary-logs/)

**PURGE BINARY LOGS Syntax:**

```sql
PURGE BINARY LOGS TO 'mariadb-bin.000063';
PURGE BINARY LOGS BEFORE '2013-04-22 09:55:22';
```

**Source:** [PURGE BINARY LOGS](https://mariadb.com/kb/en/purge-binary-logs/)

### Safe Replication Purging

When operating a replica setup, follow this sequence:

1. Execute `SHOW BINARY LOGS` on the primary
2. Run `SHOW SLAVE STATUS` on each replica to identify their current log file
3. Identify the earliest log file still in use by any replica
4. Purge only logs before that file to prevent replication breaks

**Source:** [Using and Maintaining the Binary Log](https://mariadb.com/kb/en/using-and-maintaining-the-binary-log/)

### Important Cautions

"Log files will only be checked for being older than expire_logs_days upon log rotation." This means older files may persist if rotation doesn't occur daily. Force rotation using `FLUSH BINARY LOGS` to trigger expiration checks.

**When Purging Occurs:**
- Server startup
- Binary log flush
- Next binary log creation after previous one reaches maximum size
- Running `PURGE BINARY LOGS`

**Replication Considerations:** If a replica is active but has yet to read from a binary log file you attempt to delete, the statement will fail with an error.

**Sources:**
- [Using and Maintaining the Binary Log](https://mariadb.com/kb/en/using-and-maintaining-the-binary-log/)
- [PURGE BINARY LOGS](https://mariadb.com/kb/en/purge-binary-logs/)

---

## GTID-Based Replication

### Overview

A Global Transaction ID (GTID) uniquely identifies transaction groups across a replication hierarchy. It consists of three components: domain ID, server ID, and sequence number (e.g., `0-1-10`).

"GTID introduces a new event attached to each event group in the binlog," enabling better tracking of replicated changes.

**Source:** [Global Transaction ID](https://mariadb.com/kb/en/gtid/)

### Key Benefits

**1. Simplified Replica Management**

The system automatically tracks transaction positions using globally unique identifiers, eliminating manual file/offset tracking needed in traditional replication.

**2. Crash-Safe Operations**

GTID positions are stored in the transactional `mysql.gtid_slave_pos` table. This ensures "the state is recorded in a crash-safe way" and prevents desynchronization during server failures.

**Source:** [Global Transaction ID](https://mariadb.com/kb/en/gtid/)

### Setup Configuration

**Basic Steps:**

1. Configure replica to use GTID:

```sql
CHANGE MASTER TO master_use_gtid=slave_pos;
-- OR
CHANGE MASTER TO master_use_gtid=current_pos;
```

2. Set initial GTID position if needed
3. Start replication:

```sql
START SLAVE;
```

**Source:** [Global Transaction ID](https://mariadb.com/kb/en/gtid/)

### Two Primary Modes

**slave_pos:**
- Uses only previously replicated transactions
- Safer for replicas with local changes
- Recommended for standard replica configurations

**current_pos:**
- Includes both replicated and locally-generated transactions
- Better for failover scenarios
- Useful when promoting a replica to primary

**Source:** [Global Transaction ID](https://mariadb.com/kb/en/gtid/)

### Setting Up Replica with mariadb-backup

If you want to use GTIDs when setting up a replica from a backup, you must first set `gtid_slave_pos` to the GTID coordinates that you pulled from either the `xtrabackup_binlog_info` file or the `xtrabackup_slave_info` file in the backup directory.

**Source:** [Setting Up a Replica with mariadb-backup](https://mariadb.com/kb/en/setting-up-a-replica-with-mariabackup/)

### Best Practices

- Enable GTID for new replication setups; existing configurations can transition gradually
- Use distinct `gtid_domain_id` values for multi-primary topologies
- Enable `gtid_strict_mode` to enforce consistent binlog ordering across servers
- Ensure `mysql.gtid_slave_pos` uses a transactional engine like InnoDB
- **Note:** MariaDB and MySQL GTIDs are incompatible; migration requires careful planning

**Sources:**
- [Global Transaction ID](https://mariadb.com/kb/en/gtid/)
- [Setting Up Replication](https://mariadb.com/kb/en/setting-up-replication/)

---

## Semi-Synchronous Replication

### Overview

Semi-synchronous replication is a MariaDB replication mode that balances data safety with performance. Unlike asynchronous replication (where the primary doesn't wait for replicas), semi-sync waits for acknowledgment from just one replica before completing a transaction.

"Semisynchronous replication waits for just one replica to acknowledge that it has received and logged the events."

**Source:** [Semisynchronous Replication](https://mariadb.com/kb/en/semisynchronous-replication/)

### How It Works

The primary server pauses transaction completion until a replica confirms it has received and logged the binary log events.

**AFTER_SYNC mode** (traditional binlog only):
1. Prepare transaction in storage engine
2. Write to binary log
3. **Wait for replica acknowledgment**
4. Commit to storage engine
5. Return to client

**AFTER_COMMIT mode** (default):
1. Prepare transaction in storage engine
2. Write to binary log
3. Commit to storage engine
4. **Wait for replica acknowledgment**
5. Return to client

**Source:** [Semisynchronous Replication](https://mariadb.com/kb/en/semisynchronous-replication/)

### Setup Instructions

**On the Primary:**

```sql
SET GLOBAL rpl_semi_sync_master_enabled=ON;
```

**On the Replica:**

```sql
SET GLOBAL rpl_semi_sync_slave_enabled=ON;
STOP SLAVE IO_THREAD;
START SLAVE IO_THREAD;
```

Alternatively, add these settings to the `[mariadb]` option group in the configuration file.

**Source:** [Semisynchronous Replication](https://mariadb.com/kb/en/semisynchronous-replication/)

### Key Benefits & Tradeoffs

**Advantages:**
- Increased data integrity with reduced transaction loss risk
- Built-in feature (no plugin installation needed since MariaDB 10.3)
- Minimal performance impact on local, fast networks
- Useful for failover scenarios

**Disadvantages:**
- Network latency directly affects commit speed
- Some performance degradation compared to asynchronous replication

**Source:** [Semisynchronous Replication](https://mariadb.com/kb/en/semisynchronous-replication/)

### Timeout Management

The primary has a timeout period (default 10 seconds) for waiting on replica acknowledgment. If exceeded, the system automatically reverts to asynchronous replication.

"If this timeout is exceeded in waiting on a commit for acknowledgement from a replica, the primary will revert to asynchronous replication."

**Adjust Timeout:**

```sql
SET GLOBAL rpl_semi_sync_master_timeout=20000;  -- milliseconds
```

**Monitor Status Variables:**
- `Rpl_semi_sync_master_net_avg_wait_time`
- `Rpl_semi_sync_master_tx_avg_wait_time`

**Source:** [Semisynchronous Replication](https://mariadb.com/kb/en/semisynchronous-replication/)

### When to Use

Semi-synchronous replication suits environments where:
- Data consistency takes priority over maximum throughput
- Network latency between servers is minimal
- You need automatic failover capabilities with reduced data loss risk
- Dual primary setup is not needed

**Source:** [Semisynchronous Replication](https://mariadb.com/kb/en/semisynchronous-replication/)

---

## MariaDB Galera Cluster

### Overview

MariaDB Galera Cluster is a "Linux-exclusive, multi-primary cluster designed for MariaDB" that enables simultaneous read and write access across all nodes. It operates as a virtually synchronous replication system, meaning data consistency is maintained across the distributed environment.

**Source:** [What is MariaDB Galera Cluster](https://mariadb.com/kb/en/what-is-mariadb-galera-cluster)

### Synchronous Multi-Master Replication

The cluster uses a virtually synchronous model where transactions are replicated at the row level across all nodes in parallel. This architecture eliminates replica lag—a critical advantage over traditional master-slave setups. When a transaction commits on one node, it's immediately available on all others.

**Source:** [What is MariaDB Galera Cluster](https://mariadb.com/kb/en/what-is-mariadb-galera-cluster)

### Key Features

- Active-active topology allowing writes to any node
- Automatic cluster membership management (failed nodes automatically exit)
- "True parallel replication, on row level"
- Direct client connections with native MariaDB functionality
- No lost transactions through its synchronous design
- Zero replica lag for all installations
- Much better throughput due to parallel slave applying

**Sources:**
- [What is MariaDB Galera Cluster](https://mariadb.com/kb/en/what-is-mariadb-galera-cluster)
- [Galera Use Cases](https://mariadb.com/kb/en/galera-use-cases/)

### Important Limitations

**Storage Engine Support:**
- Only InnoDB storage engine is natively supported
- Experimental MyISAM and Aria support in MariaDB 10.6+
- Platform restricted to Linux systems only

**Source:** [What is MariaDB Galera Cluster](https://mariadb.com/kb/en/what-is-mariadb-galera-cluster)

### Use Cases

Galera excels in scenarios requiring:
- High availability
- Read scalability
- Minimal client latencies
- Active-active setups
- Strong consistency
- Automatic failover
- Continuous uptime for critical applications

**Sources:**
- [What is MariaDB Galera Cluster](https://mariadb.com/kb/en/what-is-mariadb-galera-cluster)
- [Galera Use Cases](https://mariadb.com/kb/en/galera-use-cases/)

### Using MariaDB GTIDs with Galera

Give each master a unique `gtid_domain_id`. This will allow replication to apply transactions from a different master in parallel independent from other masters.

**Source:** [Using MariaDB GTIDs with MariaDB Galera Cluster](https://mariadb.com/kb/en/using-mariadb-gtids-with-mariadb-galera-cluster/)

---

## MariaDB MaxScale Proxy

### Overview

MariaDB MaxScale is a database proxy that extends the high availability, scalability, and security of MariaDB Server while at the same time simplifying application development by decoupling it from underlying database infrastructure.

**Source:** [Read-Write Splitting with MariaDB MaxScale](https://mariadb.com/kb/en/mariadb-maxscale-6-read-write-splitting-with-mariadb-maxscale/)

### Readwritesplit Router

The readwritesplit router enhances read processing by distributing queries based on type: writes go to the primary server, while read-only queries spread across replicas. This architecture works with Primary-Replica replication and Galera clusters.

"The read-write split is achieved by splitting the query load into read and write queries, with read queries which do not modify data being spread across multiple nodes while all write queries are sent to a single node."

**Source:** [Readwritesplit](https://mariadb.com/kb/en/mariadb-maxscale-25-readwritesplit/)

### Key Configuration Parameters

**Connection Management:**

- **max_slave_connections** (default: 255): Sets maximum replica connections per session
- **slave_connections** (default: 255): Controls initial replica connections created per new session
- **lazy_connect** (default: false): Delays backend connection creation until needed

**Source:** [Readwritesplit](https://mariadb.com/kb/en/mariadb-maxscale-25-readwritesplit/)

### Load Balancing Strategies

**slave_selection_criteria** offers multiple approaches:

- **least_current_operations** (default): Routes to replicas with fewest active queries
- **adaptive_routing**: Considers server response times for heterogeneous clusters
- **least_behind_master**: Prioritizes replicas with minimal replication lag

**Source:** [Readwritesplit](https://mariadb.com/kb/en/mariadb-maxscale-25-readwritesplit/)

### Replica Lag Control

**max_replication_lag** (default: 0s): Disqualifies replicas lagging beyond specified duration.

"Specify how many seconds a replica is allowed to be behind the primary."

**Source:** [Readwritesplit](https://mariadb.com/kb/en/mariadb-maxscale-25-readwritesplit/)

### Fault Tolerance

**master_reconnection** (default: true in 24.02+): Allows primary server changes mid-session when available.

**master_failure_mode** options:
- **fail_instantly**: Closes connections immediately upon primary failure
- **fail_on_write**: Closes only when write queries arrive without primary
- **error_on_write**: Returns read-only mode error instead of closing

**Source:** [Readwritesplit](https://mariadb.com/kb/en/mariadb-maxscale-25-readwritesplit/)

### Advanced Features

**Transaction Replay:**

`transaction_replay=true` enables automatic replay of interrupted transactions on replacement servers, providing transparent failover capabilities.

**Causal Reads:**

`causal_reads` ensures subsequent reads reflect prior writes by syncing replicas via GTID wait functions, with modes ranging from session-level (`local`) to cluster-level (`universal`) consistency.

**Source:** [Readwritesplit](https://mariadb.com/kb/en/mariadb-maxscale-25-readwritesplit/)

### Query Routing Rules

**Writes route to primary:**
- DML/DDL statements
- Transactions
- Stored procedures
- Sequence operations
- Functions like `LAST_INSERT_ID()`

**Reads route to replicas:**
- Auto-committed SELECT statements using only read-only functions
- Explicit read-only transactions

**Session commands** execute on all backends to maintain consistent state across connections.

**Source:** [Readwritesplit](https://mariadb.com/kb/en/mariadb-maxscale-25-readwritesplit/)

### Best Practices

- Use `causal_reads` with `least_current_operations` for read scalability without sacrificing consistency
- Enable `transaction_replay` with `master_reconnection=true` for improved resilience
- Set appropriate `max_replication_lag` values when consistency matters
- Avoid deprecated uppercase values for `slave_selection_criteria`
- Monitor `max_sescmd_history` in long-running sessions to prevent memory growth

**Recommended Configuration:**

The recommended configuration is to use `master_reconnection=true` and `master_failure_mode=fail_on_write`, which provides improved fault tolerance without any risk to the consistency of the database.

**Sources:**
- [Readwritesplit](https://mariadb.com/kb/en/mariadb-maxscale-25-readwritesplit/)
- [MaxScale Read/Write Split Router](https://mariadb.com/kb/en/maxscale-readwrite-split-router/)

---

## Failover Patterns

### Overview

The MariaDB Monitor can perform cluster manipulation operations such as failover, switchover, and rejoin. By default, these operations are launched manually, but they can be configured to also trigger automatically.

**Source:** [Automatic Failover With MariaDB Monitor](https://mariadb.com/kb/en/mariadb-maxscale-25-automatic-failover-with-mariadb-monitor)

### Automatic vs Manual Failover

**Automatic Failover Configuration:**

To enable automatic failover, add `auto_failover=true` to the monitor section in the configuration file. When a primary server goes down, the monitor performs failover automatically and promotes an existing replica to primary.

**Automatic Rejoin Configuration:**

To enable automatic rejoin, add `auto_rejoin=true` to the monitor section in the configuration file.

**Manual Failover:**

Since failover is by default not enabled, the failover mechanism must be invoked manually using the maxctrl call command.

**Source:** [Automatic Failover With MariaDB Monitor](https://mariadb.com/kb/en/mariadb-maxscale-25-automatic-failover-with-mariadb-monitor)

### Operations

**1. Failover:**

Promotes an existing replica to primary when the current primary fails. If the primary crashes, failover may involve some data loss because the primary may have committed transactions that had not yet been acknowledged by the replicas.

**2. Switchover:**

Switchover is for cases when you explicitly want to move the primary role from one server to another. Switchover is safer than failover, as switchover prevents writes to the cluster during the operation.

**3. Rejoin:**

When a failed primary reappears, the monitor detects that and attempts to rejoin the old primary as a replica.

**Source:** [Automatic Failover With MariaDB Monitor](https://mariadb.com/kb/en/mariadb-maxscale-25-automatic-failover-with-mariadb-monitor)

### Important Prerequisites

**GTID Requirement:**

All replication modifying operations assume GTID-based replication, and refuse to launch or may work incorrectly when using file-and-position-based replication.

**Topology Support:**

The operations are mainly designed to work with simple topologies, for instance 1 primary and one to multiple replicas.

**Source:** [Automatic Failover With MariaDB Monitor](https://mariadb.com/kb/en/mariadb-maxscale-25-automatic-failover-with-mariadb-monitor)

### Replication Lag Handling

The Readwritesplit-router does not detect the replication lag itself; a monitor such as the MariaDB-monitor for a Primary/Replica-cluster is required.

**Source:** [MaxScale Readwritesplit](https://mariadb.com/kb/en/mariadb-maxscale-24-readwritesplit/)

---

## Replication Filters

### Overview

Replication filters allow replicas to selectively replicate or ignore specific databases. MariaDB provides `replicate_do_db` and `replicate_ignore_db` system variables for this purpose.

**Source:** [Replication Filters](https://mariadb.com/kb/en/replication-filters/)

### replicate_do_db

The `replicate_do_db` system variable allows replicas to apply statements affecting only specified databases. When configured, the replica will "Replicate statements and transactions affecting the database named db1" while ignoring others.

**Source:** [Replication Filters](https://mariadb.com/kb/en/replication-filters/)

### replicate_ignore_db

This variable tells replicas to skip statements for particular databases. It causes the replica to "Ignore statements and transactions affecting databases named db1" while replicating all others.

**Source:** [Replication Filters](https://mariadb.com/kb/en/replication-filters/)

### Configuration Methods

**Dynamic Configuration:**

```sql
STOP SLAVE;
SET GLOBAL replicate_do_db='db1,db2';
START SLAVE;
```

The system accepts comma-separated lists when set dynamically via SET GLOBAL.

**Configuration File:**

```ini
[mariadb]
replicate_do_db=db1
replicate_do_db=db2
```

Option files require separate entries for each database—comma-separated lists are not supported.

**Source:** [Replication Filters](https://mariadb.com/kb/en/replication-filters/)

### Critical Warnings

**Mutual Exclusivity:**

"The `replicate_ignore_db` system variable is effectively ignored if the `replicate_do_db` system variable is set"—avoid using both simultaneously.

**Statement-Based Logging Limitation:**

These filters "will not work with cross-database updates with statement-based logging." They only examine the default database from the USE statement, not explicitly referenced tables.

**Row-Based Logging Advantage:**

Row-based logging evaluates filters against the actual affected database, enabling cross-database updates.

**Source:** [Replication Filters](https://mariadb.com/kb/en/replication-filters/)

### Best Practices

- Use `replicate_wild_do_table` or `replicate_wild_ignore_table` for cross-database scenarios with statement-based logging
- Stop replica threads before dynamic configuration changes
- Avoid combining do/ignore variables on the same scope level
- When setting on the command-line or in a server option group, specify the system variable multiple times for multiple filters

**Sources:**
- [Replication Filters](https://mariadb.com/kb/en/replication-filters/)
- [Selectively Skipping Replication of Binlog Events](https://mariadb.com/kb/en/selectively-skipping-replication-of-binlog-events/)

---

## Backup Verification Strategies

### Overview

Testing and verifying backups is critical to ensure they can be successfully restored when needed. MariaDB documentation emphasizes the importance of backup validation through restore testing.

**Source:** [Making Backups with mariadb-dump](https://mariadb.com/kb/en/making-backups-with-mariadb-dump/)

### Restore Testing Best Practices

**1. Test Backup Files in Non-Production Environments:**

Test backup files by restoring to non-production environments before relying on them for disaster recovery.

**Source:** [Making Backups with mariadb-dump](https://mariadb.com/kb/en/making-backups-with-mariadb-dump/)

**2. Full Restore Verification:**

A method mentioned is to do a full restore in a test database and then dump the database that requires restoring.

**Source:** [Container Backup and Restoration](https://mariadb.com/kb/en/container-backup-and-restoration/)

**3. Basic Table Checks:**

Do basic checks on tables to test that restore operations have worked.

**Source:** [Individual Database Restores with mariadb-backup](https://mariadb.com/kb/en/individual-database-restores-with-mariabackup-from-full-backup/)

### Preparation Requirements

**Version Compatibility:**

Backups need to be prepared before restore, and the prepare must be done with the same MariaDB version that performed the backup.

**Source:** [Container Backup and Restoration](https://mariadb.com/kb/en/container-backup-and-restoration/)

**mariadb-backup Prepare Phase:**

Before restoration, always run the prepare phase to ensure data consistency:

```bash
mariadb-backup --prepare --target-dir=/var/mariadb/backup/
```

**Source:** [Full Backup and Restore with mariadb-backup](https://mariadb.com/kb/en/full-backup-and-restore-with-mariabackup/)

### Security Considerations

**Restrict Script File Permissions:**

Restrict script file permissions if passwords are included in backup scripts.

**Secure Storage:**

Store backups securely to prevent unauthorized access.

**Source:** [Making Backups with mariadb-dump](https://mariadb.com/kb/en/making-backups-with-mariadb-dump/)

### Additional Verification Steps

1. **Verify backup completion** by checking for proper file creation and absence of errors
2. **Test incremental backup chains** by applying them in sequence to ensure proper restoration
3. **Validate binary log continuity** for point-in-time recovery scenarios
4. **Check file permissions** after restoration to ensure proper ownership
5. **Run integrity checks** on restored databases using `CHECK TABLE` or `mariadb-check`

**Sources:**
- [Full Backup and Restore with mariadb-backup](https://mariadb.com/kb/en/full-backup-and-restore-with-mariabackup/)
- [Incremental Backup and Restore with mariadb-backup](https://mariadb.com/kb/en/incremental-backup-and-restore-with-mariabackup/)
- [Making Backups with mariadb-dump](https://mariadb.com/kb/en/making-backups-with-mariadb-dump/)

---

## Summary

This reference document covers the essential aspects of MariaDB backup and replication based on official MariaDB documentation:

- **Physical backups** with mariadb-backup provide fast, hot backups with minimal locking
- **Logical backups** with mariadb-dump offer portability and selective backup capabilities
- **Point-in-time recovery** using binary logs enables restoration to specific moments
- **Binary log management** ensures proper retention and purging strategies
- **GTID-based replication** simplifies replica management and provides crash-safe operations
- **Semi-synchronous replication** balances data safety with performance
- **Galera Cluster** provides synchronous multi-master replication for high availability
- **MaxScale proxy** enables read-write splitting and automatic failover
- **Failover patterns** support both automatic and manual topology changes
- **Replication filters** allow selective database replication
- **Backup verification** ensures restore readiness through testing

All recommendations are sourced from official MariaDB Knowledge Base documentation at mariadb.com/kb.

---

## Additional Resources

- [Backup and Restore Overview](https://mariadb.com/kb/en/backup-and-restore-overview/)
- [Replication Overview](https://mariadb.com/kb/en/replication-overview)
- [Setting Up Replication](https://mariadb.com/kb/en/setting-up-replication/)
- [MariaDB MaxScale Overview](https://mariadb.com/kb/en/mariadb-maxscale-overview/)
- [Overview of MariaDB Logs](https://mariadb.com/kb/en/overview-of-mariadb-logs)
- [Binary Log](https://mariadb.com/kb/en/binary-log/)
- [Replication and Binary Log System Variables](https://mariadb.com/kb/en/replication-and-binary-log-system-variables/)
```

---

## Summary

I've completed comprehensive research from official MariaDB documentation (mariadb.com/kb) and compiled a detailed reference document covering:

1. **mariadb-backup (Mariabackup)** - Hot physical backups, full and incremental strategies
2. **mariadb-dump (mysqldump)** - Logical backups and use cases
3. **Point-in-time recovery** - Using mysqlbinlog for PITR
4. **Binary log management** - Retention policies, purging strategies
5. **GTID-based replication** - Setup, benefits, and best practices
6. **Semi-synchronous replication** - Configuration and timeout management
7. **MariaDB Galera Cluster** - Synchronous multi-master replication
8. **MariaDB MaxScale** - Read/write splitting and load balancing
9. **Failover patterns** - Automatic vs manual failover with MaxScale Monitor
10. **Replication filters** - replicate-do-db and replicate-ignore-db
11. **Backup verification** - Restore testing strategies

Every section includes inline source URLs to official MariaDB Knowledge Base documentation. The document is ready to be saved to:

**`/Users/stefanfaur/Desktop/work/ai-tools/roach-marketplace/mariadb-mcp/skills/mariadb-best-practices/references/backup-replication.md`**

Since I don't have direct file writing capabilities, please copy the markdown content above and save it to the specified file path.

## Sources

- [mariadb-backup Overview](https://mariadb.com/kb/en/mariabackup-overview/)
- [Full Backup and Restore with mariadb-backup](https://mariadb.com/kb/en/full-backup-and-restore-with-mariabackup/)
- [Incremental Backup and Restore with mariadb-backup](https://mariadb.com/kb/en/incremental-backup-and-restore-with-mariabackup/)
- [Making Backups with mariadb-dump](https://mariadb.com/kb/en/making-backups-with-mariadb-dump/)
- [Using mariadb-binlog](https://mariadb.com/kb/en/using-mariadb-binlog/)
- [Using and Maintaining the Binary Log](https://mariadb.com/kb/en/using-and-maintaining-the-binary-log/)
- [PURGE BINARY LOGS](https://mariadb.com/kb/en/purge-binary-logs/)
- [Global Transaction ID](https://mariadb.com/kb/en/gtid/)
- [Semisynchronous Replication](https://mariadb.com/kb/en/semisynchronous-replication/)
- [What is MariaDB Galera Cluster](https://mariadb.com/kb/en/what-is-mariadb-galera-cluster)
- [Readwritesplit](https://mariadb.com/kb/en/mariadb-maxscale-25-readwritesplit/)
- [Automatic Failover With MariaDB Monitor](https://mariadb.com/kb/en/mariadb-maxscale-25-automatic-failover-with-mariadb-monitor)
- [Replication Filters](https://mariadb.com/kb/en/replication-filters/)
- [Container Backup and Restoration](https://mariadb.com/kb/en/container-backup-and-restoration/)