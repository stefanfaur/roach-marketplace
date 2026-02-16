# Query Profiling Examples

## N+1 Query Detection

### Before (N+1 Problem)
```python
# Django — triggers N+1: one query per author
books = Book.objects.all()
for book in books:
    print(book.author.name)  # Each iteration = new query
```

### After (Fixed)
```python
# Django — single query with JOIN
books = Book.objects.select_related('author').all()
for book in books:
    print(book.author.name)  # No additional queries
```

## Index Recommendations

### Identify Missing Index
```sql
-- Slow: full table scan on large orders table
SELECT * FROM orders WHERE customer_id = 123 AND status = 'pending';

-- EXPLAIN shows Seq Scan — add composite index:
CREATE INDEX idx_orders_customer_status ON orders (customer_id, status);
```

## Query Optimization

### Before (Subquery)
```sql
SELECT * FROM users
WHERE id IN (SELECT user_id FROM orders WHERE total > 100);
```

### After (JOIN)
```sql
SELECT DISTINCT u.* FROM users u
INNER JOIN orders o ON u.id = o.user_id
WHERE o.total > 100;
```

## Connection Pooling

### PostgreSQL (pgBouncer config)
```ini
[pgbouncer]
pool_mode = transaction
max_client_conn = 200
default_pool_size = 20
```

### Application-level (Python/SQLAlchemy)
```python
engine = create_engine(
    DATABASE_URL,
    pool_size=20,
    max_overflow=10,
    pool_timeout=30,
    pool_recycle=1800,
)
```
