# Hibernate ORM and QueryDSL Best Practices for MariaDB

Comprehensive reference for Hibernate dialect selection, entity mapping, fetch strategies, N+1 prevention, caching, batch processing, connection pooling, QueryDSL patterns, and identifier generation.

## Table of Contents

1. [MariaDB Dialect Configuration](#1-mariadb-dialect-configuration)
2. [Entity Mapping Best Practices](#2-entity-mapping-best-practices)
3. [Fetch Strategy Selection](#3-fetch-strategy-selection)
4. [N+1 Query Detection and Prevention](#4-n1-query-detection-and-prevention)
5. [Second-Level Cache Configuration](#5-second-level-cache-configuration)
6. [Batch Insert/Update Tuning](#6-batch-insertupdate-tuning)
7. [Connection Pooling with HikariCP](#7-connection-pooling-with-hikaricp)
8. [QueryDSL Patterns](#8-querydsl-patterns)
9. [Identifier Generation Strategies](#9-identifier-generation-strategies)

---

## 1. MariaDB Dialect Configuration

### Choosing the Correct Dialect

| Dialect | MariaDB Version | Key Features |
|---------|----------------|--------------|
| `MariaDBDialect` | Any | Base class |
| `MariaDB53Dialect` | 5.3+ | Microsecond precision for Time/Timestamp |
| `MariaDB103Dialect` | 10.3+ | Database sequence support |
| `MariaDB106Dialect` | 10.6+ | Skip-locked row locking |

**Use MariaDB-specific dialects (not MySQL dialects) from Hibernate 5.2.8+.**

```properties
hibernate.dialect=org.hibernate.dialect.MariaDB53Dialect
hibernate.connection.driver_class=org.mariadb.jdbc.Driver
hibernate.connection.url=jdbc:mariadb://127.0.0.1/database_name
```

**Sources:**
- [MariaDB Dialects — In Relation To](https://in.relation.to/2017/02/16/mariadb-dialects/)
- [MariaDBDialect Javadocs](https://docs.hibernate.org/orm/current/javadocs/org/hibernate/dialect/MariaDBDialect.html)
- [MariaDB103Dialect Javadocs](https://docs.jboss.org/hibernate/orm/5.2/javadocs/org/hibernate/dialect/MariaDB103Dialect.html)

---

## 2. Entity Mapping Best Practices

### String Types

`String` without length specification defaults to `VARCHAR(255)`. Always specify length.

```java
@Column(length = 100)
private String username; // VARCHAR(100)

@Column(columnDefinition = "TEXT")
private String description; // TEXT type
```

Source: [Chapter 2. Mapping Entities](https://docs.hibernate.org/stable/annotations/reference/en/html/entity.html)

### Numeric Types — BigDecimal

Always specify precision and scale. **Both default to 0 if not specified**, causing truncation.

```java
@Column(precision = 12, scale = 2)
private BigDecimal price; // DECIMAL(12,2)
```

Source: [Column Annotation Javadocs](https://docs.jboss.org/hibernate/jpa/2.1/api/javax/persistence/Column.html)

### Temporal Types

**Modern approach (Hibernate 5.2+):** Use `java.time` types. `@Temporal` is NOT required.

```java
@Basic
private LocalDate birthDate;      // DATE
@Basic
private LocalDateTime createdAt;  // TIMESTAMP
@Basic
private Instant timestamp;        // TIMESTAMP
```

**Legacy approach:** Use `@Temporal` with `java.util.Date`.

```java
@Temporal(TemporalType.TIMESTAMP)
private java.util.Date createdAt; // TIMESTAMP
```

**Best Practice:** Use `java.time` types (LocalDate, LocalDateTime, Instant) instead of legacy Date/Calendar.

**Sources:**
- [Hibernate — Mapping Date and Time | Baeldung](https://www.baeldung.com/hibernate-date-time)
- [Date and Time Mappings with Hibernate and JPA](https://thorben-janssen.com/hibernate-jpa-date-and-time/)

### Enum Types

```java
@Enumerated(EnumType.STRING)  // Preferred — stores name, safer for schema evolution
private Status status;

@Enumerated(EnumType.ORDINAL) // Fragile — stores ordinal position
private Priority priority;
```

---

## 3. Fetch Strategy Selection

### LAZY vs EAGER Defaults

| Annotation | JPA Default |
|-----------|-------------|
| `@OneToOne` | **EAGER** |
| `@ManyToOne` | **EAGER** |
| `@OneToMany` | LAZY |
| `@ManyToMany` | LAZY |

**Best Practice:** Mark ALL associations as LAZY. Override per-query with dynamic fetch strategies.

```java
@ManyToOne(fetch = FetchType.LAZY)
private Department department;
```

### @BatchSize

Batches lazy loading using SQL `IN` clauses instead of individual queries:

```java
@OneToMany(mappedBy = "department")
@BatchSize(size = 25)
private List<Employee> employees;
```

Generates: `SELECT * FROM employees WHERE department_id IN (?, ?, ..., ?)`

Source: [BatchSize Javadocs](https://docs.jboss.org/hibernate/orm/6.5/javadocs/org/hibernate/annotations/BatchSize.html)

### @Fetch(FetchMode.SUBSELECT)

Loads all collection elements using a single subselect query:

```java
@OneToMany(mappedBy = "department", fetch = FetchType.LAZY)
@Fetch(FetchMode.SUBSELECT)
private List<Employee> employees;
```

### @EntityGraph (JPA 2.1+)

Declarative fetch plan control:

```java
@Entity
@NamedEntityGraph(name = "Employee.projects",
    attributeNodes = @NamedAttributeNode("projects"))
public class Employee { ... }

// Usage
Map<String, Object> hints = new HashMap<>();
hints.put("javax.persistence.fetchgraph",
    entityManager.getEntityGraph("Employee.projects"));
Employee emp = entityManager.find(Employee.class, id, hints);
```

**Graph types:**
- **FETCH** (`fetchgraph`): Specified = EAGER, all others = LAZY
- **LOAD** (`loadgraph`): Specified = EAGER, others = their default

**Sources:**
- [Fetching — Hibernate 5.2 User Guide](https://docs.hibernate.org/orm/5.2/userguide/html_single/chapters/fetching/Fetching.html)
- [Chapter 20. Improving performance](https://docs.jboss.org/hibernate/orm/4.3/manual/en-US/html/ch20.html)

---

## 4. N+1 Query Detection and Prevention

### What Is N+1?

1 query fetches N parents, then N additional queries fetch each parent's children.

### Detection

```properties
# Enable SQL logging
hibernate.show_sql=true
hibernate.format_sql=true
```

```java
// Use Hibernate Statistics
Statistics stats = sessionFactory.getStatistics();
stats.setStatisticsEnabled(true);
long queryCount = stats.getQueryExecutionCount();
```

Source: [Detecting N+1 problem using Statistics](https://discourse.hibernate.org/t/detecting-n-1-problem-using-statistics/10429)

### Prevention Strategies

**1. JOIN FETCH in JPQL:**
```java
"SELECT d FROM Department d LEFT JOIN FETCH d.employees WHERE d.active = true"
```

**2. @EntityGraph:**
```java
@EntityGraph(attributePaths = {"employees", "employees.projects"})
List<Department> findAll();
```

**3. @BatchSize** (see above)

**4. FetchMode.SUBSELECT** (see above)

**5. DTO Projections** (avoid fetching full entities):
```java
"SELECT new com.example.DepartmentDTO(d.id, d.name, COUNT(e)) " +
"FROM Department d LEFT JOIN d.employees e GROUP BY d.id, d.name"
```

**Sources:**
- [N+1 Problem in Hibernate | Baeldung](https://www.baeldung.com/spring-hibernate-n1-problem)
- [Preventing N+1 using EntityGraph](https://tech.asimio.net/2020/11/06/Preventing-N-plus-1-select-problem-using-Spring-Data-JPA-EntityGraph.html)

---

## 5. Second-Level Cache Configuration

### Setup with Ehcache

```properties
hibernate.cache.use_second_level_cache=true
hibernate.cache.region.factory_class=org.hibernate.cache.jcache.JCacheRegionFactory
hibernate.javax.cache.provider=org.ehcache.jsr107.EhcacheCachingProvider
```

```java
@Entity
@Cacheable
@org.hibernate.annotations.Cache(usage = CacheConcurrencyStrategy.READ_WRITE)
public class Employee { ... }
```

### Concurrency Strategies

| Strategy | Use Case |
|----------|----------|
| `READ_ONLY` | Immutable entities |
| `READ_WRITE` | Entities that are updated |
| `NONSTRICT_READ_WRITE` | Relaxed consistency, better performance |
| `TRANSACTIONAL` | Full JTA transactional cache |

### Query Cache

```properties
hibernate.cache.use_query_cache=true
```

```java
entityManager.createQuery("SELECT e FROM Employee e WHERE e.active = true")
    .setHint("org.hibernate.cacheable", true)
    .getResultList();
```

**Sources:**
- [Hibernate Second-Level Cache | Baeldung](https://www.baeldung.com/hibernate-second-level-cache)
- [How to use Ehcache as Hibernate's 2nd Level Cache](https://thorben-janssen.com/hibernate-ehcache/)

---

## 6. Batch Insert/Update Tuning

### Key Properties

```properties
hibernate.jdbc.batch_size=25          # 10-50 recommended
hibernate.order_inserts=true          # Group inserts by entity type
hibernate.order_updates=true          # Group updates, reduces deadlocks
hibernate.jdbc.batch_versioned_data=true  # Batch @Version entities
```

### Flush and Clear Pattern

```java
for (int i = 0; i < 100000; i++) {
    em.persist(new Employee(...));
    if (i % 25 == 0) {
        em.flush();   // Send batch to database
        em.clear();   // Clear persistence context (prevent OOM)
    }
}
```

### IDENTITY Generator Disables Batching

**Critical:** `GenerationType.IDENTITY` disables JDBC batching because IDs require immediate INSERT execution.

```java
@GeneratedValue(strategy = GenerationType.IDENTITY) // Disables batching!
```

**Solution:** Use `GenerationType.SEQUENCE` with MariaDB 10.3+.

### StatelessSession for Bulk Operations

```java
StatelessSession session = sessionFactory.openStatelessSession();
Transaction tx = session.beginTransaction();
for (Employee emp : employees) {
    session.insert(emp);
}
tx.commit();
```

No first-level cache, no dirty checking, no cascading — pure performance.

**Sources:**
- [JDBC batching — Hibernate 5.2](https://docs.hibernate.org/orm/5.2/userguide/html_single/chapters/batch/Batching.html)
- [Chapter 13. Batch processing](https://docs.jboss.org/hibernate/orm/3.3/reference/en/html/batch.html)

---

## 7. Connection Pooling with HikariCP

### Core Configuration

```yaml
spring:
  datasource:
    url: jdbc:mariadb://localhost:3306/mydb
    driver-class-name: org.mariadb.jdbc.Driver
    hikari:
      maximum-pool-size: 20
      minimum-idle: 5
      connection-timeout: 30000     # 30s max wait for connection
      idle-timeout: 600000          # 10min before idle eviction
      max-lifetime: 1800000         # 30min max connection lifetime
      leak-detection-threshold: 60000  # 60s leak detection
```

### Pool Sizing

Formula: `connections = ((core_count * 2) + effective_spindle_count)`

Most applications: 10-20 connections sufficient.

Source: [HikariCP GitHub](https://github.com/brettwooldridge/HikariCP)

### Validation

For JDBC4+ drivers (MariaDB Connector/J 2.x+), HikariCP uses `Connection.isValid()` automatically. **Do NOT set `connectionTestQuery`.**

### Leak Detection

Set `leak-detection-threshold` to detect unclosed connections:
- **Dev/Test**: 5000-10000ms
- **Production**: 30000-60000ms

### MariaDB-Specific

Set `max-lifetime` below MariaDB's `wait_timeout` (default 28800s) to prevent server-side connection closures.

```sql
SHOW VARIABLES LIKE 'wait_timeout';
```

**Sources:**
- [HikariCP GitHub](https://github.com/brettwooldridge/HikariCP)
- [MariaDB Pool Datasource Implementation](https://mariadb.com/kb/en/pool-datasource-implementation/)

---

## 8. QueryDSL Patterns

### JPAQueryFactory Setup

```java
@Bean
public JPAQueryFactory jpaQueryFactory(EntityManager em) {
    return new JPAQueryFactory(em);
}
```

### Proper .fetchJoin() to Avoid N+1

```java
QEmployee employee = QEmployee.employee;
QDepartment department = QDepartment.department;

List<Employee> employees = queryFactory
    .selectFrom(employee)
    .leftJoin(employee.department, department).fetchJoin()
    .where(employee.active.isTrue())
    .fetch();
```

### Avoiding Cartesian Products

**Problem:** Multiple collection fetch joins create Cartesian products.

```java
// AVOID!
queryFactory.selectFrom(department)
    .leftJoin(department.employees).fetchJoin()
    .leftJoin(department.projects).fetchJoin()  // Cartesian product!
    .fetch();
```

**Solution:** Use multiple queries:

```java
List<Department> depts = queryFactory.selectFrom(department)
    .leftJoin(department.employees).fetchJoin().fetch();

List<Project> projects = queryFactory.selectFrom(project)
    .where(project.department.in(depts)).fetch();
```

Source: [Fix MultipleBagFetchException](https://thorben-janssen.com/fix-multiplebagfetchexception-hibernate/)

### Pagination

```java
queryFactory.selectFrom(employee)
    .where(employee.active.isTrue())
    .orderBy(employee.lastName.asc())  // Always include orderBy with pagination!
    .offset(20).limit(10)
    .fetch();
```

For large offsets, consider keyset pagination instead.

### fetchCount() — Deprecated Since 5.0.0

Use separate count query:

```java
// Data query
List<Employee> data = queryFactory.selectFrom(employee)
    .where(employee.active.isTrue())
    .offset(0).limit(10).fetch();

// Count query (separate)
Long count = queryFactory.select(employee.count())
    .from(employee)
    .where(employee.active.isTrue())
    .fetchOne();
```

Source: [fetchResults deprecation](https://github.com/querydsl/querydsl/issues/3251)

### BooleanBuilder for Dynamic Queries

```java
BooleanBuilder builder = new BooleanBuilder();
if (name != null) builder.and(employee.name.containsIgnoreCase(name));
if (dept != null) builder.and(employee.department.name.eq(dept));
if (active != null) builder.and(employee.active.eq(active));

queryFactory.selectFrom(employee).where(builder).fetch();
```

### DTO Projections

**With @QueryProjection (compile-time safe, preferred):**

```java
public class EmployeeDTO {
    @QueryProjection
    public EmployeeDTO(Long id, String name, String deptName) { ... }
}

// Uses generated QEmployeeDTO
queryFactory.select(new QEmployeeDTO(employee.id, employee.name, department.name))
    .from(employee).leftJoin(employee.department, department).fetch();
```

**With Projections.constructor (runtime):**

```java
queryFactory.select(Projections.constructor(EmployeeDTO.class,
    employee.id, employee.name, department.name))
    .from(employee).leftJoin(employee.department, department).fetch();
```

**Sources:**
- [QueryDSL Reference Guide](http://querydsl.com/static/querydsl/4.1.3/reference/html_single/)
- [JPAQueryFactory API](https://querydsl.com/static/querydsl/latest/apidocs/com/querydsl/jpa/impl/JPAQueryFactory.html)
- [JPA — Querydsl Projections](https://dzone.com/articles/jpa-querydsl-projections)

---

## 9. Identifier Generation Strategies

### IDENTITY vs SEQUENCE

| Strategy | MariaDB Version | JDBC Batching | Performance |
|----------|----------------|---------------|-------------|
| `IDENTITY` | Any | **Disabled** | Lower for bulk |
| `SEQUENCE` | 10.3+ | **Enabled** | Higher for bulk |
| `TABLE` | Any | Enabled | Lowest (table locking) |
| `AUTO` | Varies | Depends | Unpredictable |

### Recommended: SEQUENCE (MariaDB 10.3+)

```java
@Id
@GeneratedValue(strategy = GenerationType.SEQUENCE, generator = "emp_gen")
@SequenceGenerator(
    name = "emp_gen",
    sequenceName = "employee_seq",
    allocationSize = 50  // Pre-allocates IDs, reduces DB roundtrips
)
private Long id;
```

### Fallback: IDENTITY (MariaDB < 10.3)

```java
@Id
@GeneratedValue(strategy = GenerationType.IDENTITY)
private Long id;
```

**Trade-off:** Simpler but disables JDBC batching.

### Avoid AUTO

`GenerationType.AUTO` behavior varies by Hibernate version and MariaDB version. **Always specify IDENTITY or SEQUENCE explicitly.**

**Sources:**
- [An Overview of Identifiers in Hibernate/JPA | Baeldung](https://www.baeldung.com/hibernate-identifiers)
- [MariaDB 10.3 supports database sequences](https://vladmihalcea.com/mariadb-10-3-database-sequences/)
- [How to generate JPA entity identifier values using a database sequence](https://vladmihalcea.com/jpa-entity-identifier-sequence/)

---

## Summary

| Topic | Key Recommendation |
|-------|-------------------|
| Dialect | Use MariaDB-specific dialect matching your version |
| String mapping | Always specify `@Column(length=...)` |
| Temporal mapping | Use `java.time` types without `@Temporal` |
| BigDecimal | Always specify `precision` and `scale` |
| Fetch strategy | Default ALL to LAZY, use dynamic fetch per query |
| N+1 prevention | JOIN FETCH, @EntityGraph, @BatchSize, SUBSELECT |
| Caching | Ehcache/Caffeine with READ_WRITE for mutable entities |
| Batching | `batch_size=25`, `order_inserts=true`, flush/clear pattern |
| Connection pool | HikariCP, 10-20 connections, leak detection enabled |
| QueryDSL | JPAQueryFactory, avoid multiple collection fetchJoins |
| Pagination | Separate count query, keyset pagination for large offsets |
| DTOs | @QueryProjection or Projections.constructor |
| ID generation | SEQUENCE (MariaDB 10.3+) over IDENTITY for batching |

---

## Sources

- [MariaDB Dialects — In Relation To](https://in.relation.to/2017/02/16/mariadb-dialects/)
- [MariaDBDialect Javadocs](https://docs.hibernate.org/orm/current/javadocs/org/hibernate/dialect/MariaDBDialect.html)
- [Chapter 2. Mapping Entities](https://docs.hibernate.org/stable/annotations/reference/en/html/entity.html)
- [Hibernate — Mapping Date and Time | Baeldung](https://www.baeldung.com/hibernate-date-time)
- [Fetching — Hibernate 5.2 User Guide](https://docs.hibernate.org/orm/5.2/userguide/html_single/chapters/fetching/Fetching.html)
- [N+1 Problem in Hibernate | Baeldung](https://www.baeldung.com/spring-hibernate-n1-problem)
- [Hibernate Second-Level Cache | Baeldung](https://www.baeldung.com/hibernate-second-level-cache)
- [JDBC batching — Hibernate 5.2](https://docs.hibernate.org/orm/5.2/userguide/html_single/chapters/batch/Batching.html)
- [HikariCP GitHub](https://github.com/brettwooldridge/HikariCP)
- [MariaDB Pool Datasource Implementation](https://mariadb.com/kb/en/pool-datasource-implementation/)
- [QueryDSL Reference Guide](http://querydsl.com/static/querydsl/4.1.3/reference/html_single/)
- [JPAQueryFactory API](https://querydsl.com/static/querydsl/latest/apidocs/com/querydsl/jpa/impl/JPAQueryFactory.html)
- [fetchResults deprecation](https://github.com/querydsl/querydsl/issues/3251)
- [Fix MultipleBagFetchException](https://thorben-janssen.com/fix-multiplebagfetchexception-hibernate/)
- [JPA — Querydsl Projections](https://dzone.com/articles/jpa-querydsl-projections)
- [An Overview of Identifiers in Hibernate/JPA | Baeldung](https://www.baeldung.com/hibernate-identifiers)
- [MariaDB 10.3 supports database sequences](https://vladmihalcea.com/mariadb-10-3-database-sequences/)

---

*Document compiled from official Hibernate, QueryDSL, MariaDB, and HikariCP documentation — February 2026*
