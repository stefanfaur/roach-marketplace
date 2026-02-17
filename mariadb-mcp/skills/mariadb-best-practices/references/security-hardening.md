# MariaDB Security Hardening Reference

A comprehensive guide to MariaDB security hardening based on official MariaDB documentation.

## Table of Contents

1. [Initial Security Setup](#initial-security-setup)
2. [Principle of Least Privilege](#principle-of-least-privilege)
3. [Password Security](#password-security)
4. [Network Security](#network-security)
5. [SSL/TLS Encryption](#ssltls-encryption)
6. [Audit and Monitoring](#audit-and-monitoring)
7. [SQL Injection Prevention](#sql-injection-prevention)
8. [User Account Management](#user-account-management)
9. [Connection Limits](#connection-limits)
10. [Data-at-Rest Encryption](#data-at-rest-encryption)

---

## Initial Security Setup

### mariadb-secure-installation

The `mariadb-secure-installation` tool is a critical first step for hardening a new MariaDB installation. This shell script available on Unix systems improves security through several automated steps:

**What it does:**
- Sets a password for root accounts (Note: From MariaDB 10.4, Unix socket authentication is applied by default, and there may be no need to create a root password)
- Removes anonymous users that allow anyone to log in without credentials
- Disables remote root login (root should only connect from 'localhost')
- Removes the 'test' database accessible to all users
- Reloads privilege tables to ensure changes take effect immediately

**Key security principle:** Anonymous users and test databases are intended only for development and testing environments and must be removed before production deployment.

**Source:** [mariadb-secure-installation | MariaDB Documentation](https://mariadb.com/kb/en/mariadb-secure-installation/)

---

## Principle of Least Privilege

### GRANT Statement Best Practices

MariaDB supports six distinct privilege levels for granular access control:

1. **Global** (`*.*`) — Server-wide privileges stored in `mysql.global_priv`
2. **Database** (`db_name.*`) — Database-level access stored in `mysql.db`
3. **Table** (`db_name.tbl_name`) — Specific table permissions
4. **Column** — Individual column restrictions within tables
5. **Function/Procedure** — Stored routine execution rights
6. **Proxy** — User impersonation capabilities

### Critical Best Practices

**NEVER use GRANT ALL in production environments.** Instead, grant only the specific privileges required for each user's role:

```sql
-- BAD: Excessive privileges
GRANT ALL PRIVILEGES ON *.* TO 'app_user'@'localhost';

-- GOOD: Minimal required privileges for application
GRANT SELECT, INSERT, UPDATE, DELETE ON app_db.* TO 'app_user'@'localhost';

-- GOOD: Read-only analyst
GRANT SELECT ON analytics_db.* TO 'analyst'@'%.company.com';

-- GOOD: Replication-specific privilege
GRANT REPLICATION SLAVE ON *.* TO 'replicator'@'replica.server';
```

### Important Considerations

- **ALL PRIVILEGES** grants all available permissions at a given level only — not hierarchically higher levels
- Users cannot grant privileges exceeding their own scope
- The `GRANT OPTION` privilege constrains granters to their privilege level
- Column-level privileges restrict access to specific columns, preventing unauthorized data exposure

**Sources:**
- [GRANT | MariaDB Documentation](https://mariadb.com/kb/en/grant/)
- [Roles Overview | MariaDB Documentation](https://mariadb.com/kb/en/roles_overview)

---

## Password Security

### Password Validation Plugins

MariaDB provides three password validation plugins to enforce password strength requirements. **None are enabled by default** and must be explicitly installed.

#### 1. Simple Password Check Plugin

Enforces basic password complexity rules: minimum length, required digits, uppercase/lowercase letters, and special characters.

```sql
INSTALL SONAME 'simple_password_check';
```

**Configuration variables:**
- `simple_password_check_minimal_length` — Minimum password length
- `simple_password_check_digits` — Minimum number of digits required
- `simple_password_check_letters_same_case` — Minimum letters of same case
- `simple_password_check_other_characters` — Minimum special characters

**Source:** [Simple Password Check Plugin | MariaDB Documentation](https://mariadb.com/kb/en/simple-password-check-plugin/)

#### 2. Cracklib Password Check Plugin

Validates passwords against the CrackLib library and its dictionary to prevent commonly used weak passwords.

```sql
INSTALL SONAME 'cracklib_password_check';
```

**Source:** [Cracklib Password Check Plugin | MariaDB Documentation](https://mariadb.com/kb/en/cracklib-password-check-plugin/)

#### 3. Password Reuse Check Plugin

Prevents users from reusing recent passwords.

**Source:** [Password Reuse Check Plugin | MariaDB Documentation](https://mariadb.com/kb/en/password-reuse-check-plugin/)

When multiple plugins are active, a password must pass **all** validation checks by **all** plugins to be accepted.

**Source:** [Password Validation Plugins | MariaDB Documentation](https://mariadb.com/kb/en/password-validation-plugins/)

### Password Expiry

MariaDB 10.4+ supports automatic password expiration.

**`default_password_lifetime`:**
- Default: `0` (disabled)
- Positive integer N: Passwords must be changed every N days

**`disconnect_on_expired_password`:** Determines whether clients with expired passwords can connect (sandbox mode for password reset only).

```sql
-- Set global policy: passwords expire every 90 days
SET GLOBAL default_password_lifetime = 90;

-- Create user with specific expiry
CREATE USER 'developer'@'localhost'
  IDENTIFIED BY 'strong_password'
  PASSWORD EXPIRE INTERVAL 60 DAY;

-- Create user with password that never expires
CREATE USER 'service_account'@'localhost'
  IDENTIFIED BY 'strong_password'
  PASSWORD EXPIRE NEVER;

-- Manually expire a password
ALTER USER 'username'@'localhost' PASSWORD EXPIRE;
```

**Source:** [User Password Expiry | MariaDB Documentation](https://mariadb.com/kb/en/user-password-expiry/)

---

## Network Security

### bind-address Configuration

Controls which network interface(s) MariaDB listens on.

```ini
# Localhost only (most secure for single-server applications)
bind-address = 127.0.0.1

# Listen on all IPv4 interfaces (required for remote access)
bind-address = 0.0.0.0

# Listen on specific internal network interface
bind-address = 192.168.1.100
```

**Source:** [Configuring MariaDB for Remote Client Access | MariaDB Documentation](https://mariadb.com/kb/en/configuring-mariadb-for-remote-client-access/)

### skip-networking

Completely disables TCP/IP networking, forcing all connections through Unix sockets or named pipes.

```ini
[mysqld]
skip-networking
```

**Use case:** Applications running on the same server as MariaDB (maximum security).

**Source:** [Configuring MariaDB for Remote Client Access | MariaDB Documentation](https://mariadb.com/kb/en/configuring-mariadb-for-remote-client-access/)

---

## SSL/TLS Encryption

### Enabling SSL/TLS

MariaDB supports TLS 1.0-1.3 (with OpenSSL 1.1.1+).

```ini
[mysqld]
ssl_cert = /etc/mysql/ssl/server-cert.pem
ssl_key = /etc/mysql/ssl/server-key.pem
ssl_ca = /etc/mysql/ssl/ca-cert.pem
```

**Sources:**
- [SSL/TLS System Variables | MariaDB Documentation](https://mariadb.com/kb/en/ssltls-system-variables/)
- [Securing Connections for Client and Server | MariaDB Documentation](https://mariadb.com/kb/en/securing-connections-for-client-and-server/)

### require_secure_transport

Enforces encrypted connections globally. When enabled, insecure transport connections are rejected.

```ini
[mysqld]
require_secure_transport = ON
```

**Default is OFF.** Enable this in production.

Secure transports include SSL/TLS, Unix sockets, and named pipes.

**Source:** [SSL/TLS System Variables | MariaDB Documentation](https://mariadb.com/kb/en/ssltls-system-variables/)

### Per-User SSL Requirements

```sql
-- Require SSL for specific user
CREATE USER 'secure_user'@'%'
  IDENTIFIED BY 'password'
  REQUIRE SSL;

-- Require specific certificate
CREATE USER 'cert_user'@'%'
  IDENTIFIED BY 'password'
  REQUIRE X509;
```

**Source:** [Securing MariaDB | MariaDB Documentation](https://mariadb.com/kb/en/securing-mariadb/)

---

## Audit and Monitoring

### MariaDB Audit Plugin (server_audit)

The `server_audit` plugin logs server activity for security monitoring and compliance.

**What it logs:** user connections, queries executed, tables accessed, server variables changed, failed connection attempts, disconnections.

**Installation:**

```sql
-- Dynamic installation (no restart required)
INSTALL SONAME 'server_audit';
```

Or at startup:
```ini
[mysqld]
plugin-load-add = server_audit
```

**Key configuration variables:**

| Variable | Description |
|----------|-------------|
| `server_audit_logging` | Enable/disable audit logging (ON/OFF) |
| `server_audit_events` | Events to log (CONNECT, QUERY, TABLE, QUERY_DDL, QUERY_DML) |
| `server_audit_file_path` | Log file location |
| `server_audit_file_rotate_size` | Maximum log file size before rotation |
| `server_audit_file_rotations` | Number of rotated log files to keep |
| `server_audit_incl_users` | Users to audit (whitelist) |
| `server_audit_excl_users` | Users to exclude (blacklist) |
| `server_audit_syslog` | Send logs to syslog instead of file |

```sql
SET GLOBAL server_audit_logging = ON;
SET GLOBAL server_audit_events = 'CONNECT,QUERY_DDL,QUERY_DML';
SET GLOBAL server_audit_file_path = '/var/log/mysql/audit.log';
SET GLOBAL server_audit_file_rotate_size = 1073741824; -- 1GB
```

**Sources:**
- [MariaDB Community Audit Plugin | MariaDB Documentation](https://mariadb.com/kb/en/mariadb-audit-plugin/)
- [Audit Plugin Installation | MariaDB Documentation](https://mariadb.com/kb/en/mariadb-audit-plugin-installation/)
- [Audit Plugin Options and System Variables | MariaDB Documentation](https://mariadb.com/kb/en/mariadb-audit-plugin-options-and-system-variables/)

---

## SQL Injection Prevention

### Prepared Statements (Parameterized Queries)

Prepared statements are the **primary defense** against SQL injection. They separate SQL command structure from user data.

```sql
PREPARE stmt FROM 'SELECT * FROM users WHERE username = ? AND status = ?';
SET @username = 'john_doe';
SET @status = 'active';
EXECUTE stmt USING @username, @status;
DEALLOCATE PREPARE stmt;
```

**Source:** [Prepared Statements | MariaDB Documentation](https://mariadb.com/docs/server/reference/sql-statements/prepared-statements)

### Hibernate and SQL Injection Prevention

Hibernate does **not** automatically provide immunity to SQL injection. Developers must use the API correctly.

```java
// GOOD: Parameterized query
Query query = session.createQuery("FROM User WHERE username = :username");
query.setParameter("username", userInput);

// BAD: String concatenation — VULNERABLE
Query query = session.createQuery("FROM User WHERE username = '" + userInput + "'");
```

### QueryDSL Safety

QueryDSL provides type-safe SQL query construction. When properly used, QueryDSL generates parameterized queries automatically:

```java
QUser user = QUser.user;
JPAQuery<User> query = new JPAQuery<>(entityManager);
query.from(user)
     .where(user.username.eq(userInput))  // Safe — parameterized
     .fetch();
```

**Avoid:** `Expressions.stringTemplate()` with unparameterized user input.

---

## User Account Management

### mysql.user Table Cleanup

```sql
-- Identify and remove anonymous users
SELECT User, Host FROM mysql.user WHERE User = '';
DELETE FROM mysql.user WHERE User = '';
FLUSH PRIVILEGES;

-- Restrict root to localhost only
DELETE FROM mysql.user
WHERE User = 'root'
  AND Host NOT IN ('localhost', '127.0.0.1', '::1');
FLUSH PRIVILEGES;
```

**Source:** [mariadb-secure-installation | MariaDB Documentation](https://mariadb.com/kb/en/mariadb-secure-installation/)

### Database-Level User Separation

Create dedicated users for each database/application with minimal privileges:

```sql
-- Application database user
CREATE USER 'app_prod'@'app-server-1' IDENTIFIED BY 'strong_password';
GRANT SELECT, INSERT, UPDATE, DELETE ON production_db.* TO 'app_prod'@'app-server-1';

-- Read-only reporting user
CREATE USER 'reports'@'report-server' IDENTIFIED BY 'strong_password';
GRANT SELECT ON production_db.* TO 'reports'@'report-server';

-- Backup user with minimal privileges
CREATE USER 'backup'@'localhost' IDENTIFIED BY 'strong_password';
GRANT SELECT, LOCK TABLES, SHOW VIEW, EVENT, TRIGGER ON *.* TO 'backup'@'localhost';
```

**Sources:**
- [CREATE USER | MariaDB Documentation](https://mariadb.com/kb/en/create-user/)
- [GRANT | MariaDB Documentation](https://mariadb.com/kb/en/grant/)

---

## Connection Limits

### Per-User Connection Limits

```sql
-- Limit user to 10 simultaneous connections
CREATE USER 'limited_user'@'%'
  IDENTIFIED BY 'password'
  WITH MAX_USER_CONNECTIONS 10;

-- Full resource limits
CREATE USER 'limited_user'@'%'
  IDENTIFIED BY 'password'
  WITH MAX_QUERIES_PER_HOUR 1000
       MAX_UPDATES_PER_HOUR 100
       MAX_CONNECTIONS_PER_HOUR 50
       MAX_USER_CONNECTIONS 5;

-- Reset resource limits for all users
FLUSH USER_RESOURCES;
```

Resources are tracked per account (`'user'@'host'`), not per username.

**Sources:**
- [CREATE USER | MariaDB Documentation](https://mariadb.com/kb/en/create-user/)
- [Handling Too Many Connections | MariaDB Documentation](https://mariadb.com/kb/en/handling-too-many-connections/)

### Global Connection Limits

```ini
[mysqld]
max_connections = 200
back_log = 100
```

**Source:** [Server System Variables | MariaDB Documentation](https://mariadb.com/kb/en/server-system-variables/)

---

## Data-at-Rest Encryption

### InnoDB Tablespace Encryption

MariaDB supports encrypting data at rest for InnoDB tables. Data is automatically encrypted when written to disk and decrypted when read.

### Prerequisites: Encryption Key Management Plugin

#### File Key Management Plugin

```ini
[mysqld]
plugin_load_add = file_key_management
file_key_management_filename = /etc/mysql/encryption/keyfile.enc
file_key_management_filekey = FILE:/etc/mysql/encryption/keyfile.key
file_key_management_encryption_algorithm = AES_CTR
```

#### AWS Key Management Service (KMS) Plugin

```ini
[mysqld]
plugin_load_add = aws_key_management
aws_key_management_master_key_id = arn:aws:kms:region:account:key/key-id
aws_key_management_region = us-east-1
```

**Sources:**
- [AWS Key Management Encryption Plugin | MariaDB Documentation](https://mariadb.com/kb/en/aws-key-management-encryption-plugin/)
- [Encryption Key Management | MariaDB Documentation](https://mariadb.com/kb/en/encryption-key-management/)

### Enabling InnoDB Encryption

```ini
[mysqld]
innodb_encrypt_tables = ON
innodb_encrypt_log = ON
innodb_encryption_threads = 4
innodb_encryption_rotate_key_age = 7
```

Per-table encryption:

```sql
CREATE TABLE sensitive_data (
    id INT PRIMARY KEY,
    ssn VARCHAR(11),
    credit_card VARCHAR(16)
) ENCRYPTED=YES;

ALTER TABLE existing_table ENCRYPTED=YES;
```

### Additional Encryption Options

```ini
[mysqld]
aria_encrypt_tables = ON
encrypt_binlog = ON
encrypt_tmp_files = ON
```

**Sources:**
- [InnoDB Encryption Overview | MariaDB Documentation](https://mariadb.com/kb/en/innodb-encryption-overview/)
- [Enabling InnoDB Encryption | MariaDB Documentation](https://mariadb.com/kb/en/innodb-enabling-encryption/)
- [Data-at-Rest Encryption Overview | MariaDB Documentation](https://mariadb.com/kb/en/data-at-rest-encryption-overview/)

---

## Security Checklist

### Initial Setup
- [ ] Run `mariadb-secure-installation`
- [ ] Remove anonymous users
- [ ] Disable remote root access
- [ ] Remove test database
- [ ] Set strong root password (or use Unix socket auth on MariaDB 10.4+)

### Access Control
- [ ] Apply principle of least privilege for all users
- [ ] Never use `GRANT ALL` in production
- [ ] Create database-specific users with minimal privileges
- [ ] Review and audit user privileges regularly

### Password Security
- [ ] Install password validation plugin
- [ ] Configure `default_password_lifetime`
- [ ] Enable password reuse prevention

### Network Security
- [ ] Configure `bind-address` appropriately
- [ ] Consider `skip-networking` for local-only
- [ ] Implement firewall rules

### Encryption
- [ ] Enable SSL/TLS with valid certificates
- [ ] Set `require_secure_transport = ON`
- [ ] Implement data-at-rest encryption for sensitive data
- [ ] Enable binary log and temporary file encryption
- [ ] Set up key rotation schedule

### Monitoring
- [ ] Install and configure server_audit plugin
- [ ] Set up log rotation
- [ ] Monitor failed connection attempts

### Application Security
- [ ] Use prepared statements exclusively
- [ ] Never concatenate user input into SQL strings
- [ ] Validate all input at application layer

### Resource Limits
- [ ] Configure `MAX_USER_CONNECTIONS` for application users
- [ ] Set global `max_connections` based on expected load

---

*Document compiled from official MariaDB Knowledge Base (mariadb.com/kb/) — February 2026*
