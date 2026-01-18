# API-Football Caching

## Purpose

Reduce API quota usage by caching responses from the external API-Football service. Caching is transparent to consumer modules.

## Design

Cache logic is centralized in `fapi.ard` (API boundary) rather than spread across consumer modules. Consumer modules only pass a `db` parameter to fapi functions; they are unaware caching exists.

### Benefits

- Single source of truth for cache logic
- Minimal consumer module changes
- Easy to audit, test, and modify TTLs
- Transparent: consumers receive same typed responses

## Implementation

### Cache Storage

SQLite table `api_cache` with:
- Compound primary key: `(endpoint, resource_id)`
- Columns: `response` (JSON), `ttl_seconds`, `created_at`, `expires_at`
- Indexes on `expires_at` and `(endpoint, resource_id)` for efficient cleanup and lookups

### Cache Module (`api/server/cache.ard`)

**Functions:**
- `get(db, endpoint, resource_id)` → `Dynamic?` - Returns cached response or `none` on miss/expiry/error
- `set(db, endpoint, resource_id, response, ttl_seconds)` - Stores response with TTL
- `cleanup_job()` - Periodic cleanup of expired entries

**TTLs:**
- Predictions/Odds: 1-4 hours (API updates frequently)
- League/Team info: 24 hours (static within season)
- Fixtures/Team fixtures: 2-6 hours (depends on endpoint)
- Today's fixtures: 15 minutes (real-time requirement)

### API Functions (`fapi.ard`)

All 10 API endpoints check cache before calling API:

```
cached_response = cache::get(db, endpoint, resource_id)
if cached_response exists:
  return cached_response
else:
  response = send_request(url)
  cache::set(db, endpoint, resource_id, response, ttl)
  return response
```

### Consumer Integration

All consumer modules (`predictions`, `odds`, `fixtures`, `teams`, `leagues`, `analysis`) updated to pass `db` parameter to fapi calls. No cache logic added to consumers.

## Error Handling

Cache errors (query failures, decode failures) are logged and treated as cache misses. The system falls back to API calls transparently.

## Maintenance

- Cache table grows over time; old entries cleaned up hourly via `cleanup_job()`
- TTLs can be adjusted in `cache.ard` constants without code changes
- Manual purge: `DELETE FROM api_cache`
- Monitor: Check cache hits/misses in logs `[CACHE HIT]` / `[CACHE MISS]`
