// Package ffi hosts Go-side support the Ard code can't express directly.
//
// Cache is a tiny concurrency-safe string cache used to memoize upstream
// API responses (API-Football). It lives in Go because it is shared
// mutable state guarded by a mutex, accessed from every request
// goroutine — the same reason the DB handle lives here. Ard's App struct
// is a value copied into each handler closure, so shared state must be a
// pointer handle.
package ffi

import (
	"sync"
	"time"
)

type cacheEntry struct {
	value    string
	storedAt int64 // unix ms
}

type Cache struct {
	mu      sync.RWMutex
	entries map[string]cacheEntry
}

func NewCache() *Cache {
	return &Cache{entries: make(map[string]cacheEntry)}
}

// CacheGet returns the cached value when it is younger than maxAgeMs.
func CacheGet(c *Cache, key string, maxAgeMs int64) (string, bool) {
	c.mu.RLock()
	defer c.mu.RUnlock()
	e, ok := c.entries[key]
	if !ok {
		return "", false
	}
	if time.Now().UnixMilli()-e.storedAt > maxAgeMs {
		return "", false
	}
	return e.value, true
}

func CachePut(c *Cache, key string, value string) {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.entries[key] = cacheEntry{value: value, storedAt: time.Now().UnixMilli()}
}
