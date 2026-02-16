# Database Query Profiling Best Practices

## For Users

### Activation Best Practices

1. **Use Clear Trigger Phrases**
   - "Profile queries in this project"
   - "Find N+1 queries"
   - "Recommend indexes for slow queries"
   - "Optimize this SQL query"

2. **Provide Sufficient Context**
   - Include relevant file paths
   - Specify the database engine (PostgreSQL, MySQL, SQLite)
   - Mention the ORM or query builder in use
   - Identify the most critical endpoints or operations

3. **Understand Tool Permissions**
   - Read/Grep/Glob for codebase analysis
   - Bash for running EXPLAIN queries (requires database access)

### Workflow Optimization

- Start with N+1 detection (biggest wins)
- Then check for missing indexes
- Finally optimize individual complex queries
- Verify improvements with EXPLAIN ANALYZE

## Performance Tips

- Focus on queries executed per-request first
- Index columns used in WHERE, JOIN ON, ORDER BY
- Avoid SELECT * — select only needed columns
- Use connection pooling for all production applications
- Consider read replicas for heavy read workloads

## Security Considerations

- Never log or expose database credentials
- Use parameterized queries to prevent SQL injection
- Limit query result sizes to prevent memory issues
- Set appropriate query timeouts
