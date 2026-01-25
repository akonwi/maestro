DROP TABLE IF EXISTS api_cache;

CREATE TABLE api_cache (
  endpoint TEXT NOT NULL,
  resource_id TEXT NOT NULL,
  response TEXT NOT NULL,
  ttl_seconds INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  PRIMARY KEY (endpoint, resource_id)
);

CREATE INDEX idx_api_cache_expires ON api_cache(expires_at);
