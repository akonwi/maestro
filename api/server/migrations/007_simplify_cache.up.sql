-- Simplify cache table: endpoint becomes the full path (including query params)
-- Drop old table and recreate since SQLite doesn't support DROP COLUMN easily
DROP TABLE IF EXISTS api_cache;

CREATE TABLE api_cache (
  endpoint TEXT PRIMARY KEY,
  response TEXT NOT NULL,
  ttl_seconds INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);

CREATE INDEX idx_api_cache_expires ON api_cache(expires_at);
