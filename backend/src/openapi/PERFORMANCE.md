# WIRE API Performance Characteristics

Performance benchmarks, limits, and optimization guidelines for the WIRE API.

## Response Time Targets

### P50 (Median) Response Times

| Endpoint | Target | Current |
|----------|--------|---------|
| `GET /health` | < 10ms | ~5ms |
| `GET /intents` | < 100ms | ~50ms |
| `GET /intents/:id` | < 50ms | ~25ms |
| `POST /intents` | < 200ms | ~150ms |
| `PATCH /intents/:id` | < 150ms | ~100ms |
| `POST /intents/:id/challenge` | < 100ms | ~75ms |
| `POST /challenges/:challengeId/proof` | < 300ms | ~200ms |
| `POST /intents/:id/decision` | < 200ms | ~150ms |
| `POST /intents/:id/execute` | < 500ms | ~300ms |
| `GET /intents/:id/events` | < 100ms | ~60ms |
| `POST /intents/:id/bundle` | < 1000ms | ~800ms |
| `GET /beneficiaries` | < 100ms | ~50ms |
| `POST /beneficiaries` | < 150ms | ~100ms |
| `PATCH /beneficiaries/:id` | < 100ms | ~75ms |
| `GET /policies` | < 50ms | ~25ms |
| `POST /policies` | < 200ms | ~150ms |
| `POST /policies/simulate` | < 150ms | ~100ms |

### P95 (95th Percentile) Response Times

| Endpoint | Target | Current |
|----------|--------|---------|
| `GET /health` | < 50ms | ~20ms |
| `GET /intents` | < 500ms | ~300ms |
| `POST /intents` | < 1000ms | ~800ms |
| `POST /intents/:id/execute` | < 2000ms | ~1500ms |
| `POST /intents/:id/bundle` | < 5000ms | ~4000ms |

### P99 (99th Percentile) Response Times

| Endpoint | Target | Current |
|----------|--------|---------|
| All endpoints | < 2000ms | ~1500ms |
| `POST /intents/:id/bundle` | < 10000ms | ~8000ms |

## Throughput Limits

### Current Limits (Demo)

- **Requests per second:** ~100 RPS
- **Concurrent connections:** ~50
- **Database connections:** ~20

### Production Targets

- **Requests per second:** 1000+ RPS
- **Concurrent connections:** 500+
- **Database connections:** 100+

## Rate Limiting (Planned)

### Per-User Limits

- **Read operations:** 100 requests/minute
- **Write operations:** 20 requests/minute
- **Execute operations:** 5 requests/minute

### Per-Organization Limits

- **Read operations:** 1000 requests/minute
- **Write operations:** 200 requests/minute
- **Execute operations:** 50 requests/minute

### Rate Limit Headers

```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1640995200
```

## Payload Size Limits

### Request Limits

- **Maximum request body:** 1 MB
- **Maximum URL length:** 2048 characters
- **Maximum headers:** 100 headers

### Response Limits

- **Maximum response body:** 10 MB
- **List endpoints:** 1000 items per page (pagination required)

## Database Performance

### Query Performance

- **Simple queries:** < 10ms
- **Complex queries:** < 100ms
- **Aggregations:** < 500ms

### Indexes

All frequently queried fields are indexed:
- `Intent.orgId`
- `Intent.status`
- `Intent.createdAt`
- `Beneficiary.orgId`
- `Event.intentId`
- `Event.seq`

## Caching Strategy

### Cacheable Endpoints

- `GET /health` - 5 seconds
- `GET /policies` - 60 seconds
- `GET /beneficiaries` - 30 seconds

### Cache Headers

```
Cache-Control: public, max-age=60
ETag: "abc123"
Last-Modified: Wed, 01 Jan 2025 12:00:00 GMT
```

## Optimization Guidelines

### For Clients

1. **Use Pagination:**
   ```typescript
   // Don't fetch all intents at once
   const intents = await client.listIntents(); // Limited to 1000
   
   // Use pagination when available
   const page1 = await client.listIntents({ page: 1, limit: 50 });
   ```

2. **Cache Policies:**
   ```typescript
   // Policies change infrequently - cache them
   const policy = await cachedGet("/policies", 60); // Cache for 60s
   ```

3. **Batch Operations:**
   ```typescript
   // When available, use batch endpoints
   await client.createBeneficiariesBatch([...]); // Instead of multiple calls
   ```

4. **Polling Intervals:**
   ```typescript
   // Don't poll too frequently
   const pollInterval = 5000; // 5 seconds minimum
   ```

### For Server

1. **Database Connection Pooling:**
   - Use connection pooling
   - Set appropriate pool size
   - Monitor connection usage

2. **Query Optimization:**
   - Use indexes effectively
   - Avoid N+1 queries
   - Use select specific fields

3. **Response Compression:**
   - Enable gzip compression
   - Compress JSON responses > 1KB

4. **Async Processing:**
   - Use background jobs for heavy operations
   - Process audit bundles asynchronously

## Load Testing

### Test Scenarios

1. **Normal Load:**
   - 100 concurrent users
   - 10 requests/second per user
   - Duration: 5 minutes

2. **Peak Load:**
   - 500 concurrent users
   - 20 requests/second per user
   - Duration: 10 minutes

3. **Stress Test:**
   - 1000 concurrent users
   - 50 requests/second per user
   - Duration: 5 minutes

### Expected Results

- **Normal Load:** All requests succeed, P95 < 500ms
- **Peak Load:** 95% requests succeed, P95 < 1000ms
- **Stress Test:** 80% requests succeed, graceful degradation

## Monitoring

### Key Metrics

- **Response Time:** P50, P95, P99
- **Error Rate:** 4xx, 5xx errors per second
- **Throughput:** Requests per second
- **Database:** Query time, connection pool usage
- **Memory:** Heap usage, GC frequency

### Alerts

- **P95 > 1000ms:** Warning
- **P95 > 2000ms:** Critical
- **Error rate > 1%:** Warning
- **Error rate > 5%:** Critical
- **Database connections > 80%:** Warning

## Scalability

### Horizontal Scaling

- **Stateless Design:** All endpoints are stateless
- **Load Balancing:** Supports multiple instances
- **Database:** Read replicas for read-heavy operations

### Vertical Scaling

- **CPU:** Scales with concurrent requests
- **Memory:** Scales with cached data
- **Database:** Scales with connection pool size

## Future Optimizations

1. **CDN Integration:** Cache static responses
2. **GraphQL:** For complex queries
3. **WebSockets:** For real-time updates
4. **Edge Computing:** Reduce latency
5. **Database Sharding:** For large datasets
