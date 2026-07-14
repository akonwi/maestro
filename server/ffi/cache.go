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

type rateWindow struct {
	startedAt int64
	count     int
}

const maxCacheEntries = 1024

type Cache struct {
	mu          sync.RWMutex
	entries     map[string]cacheEntry
	rateWindows map[string]rateWindow
}

func NewCache() *Cache {
	return &Cache{
		entries:     make(map[string]cacheEntry),
		rateWindows: make(map[string]rateWindow),
	}
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
	if _, exists := c.entries[key]; !exists && len(c.entries) >= maxCacheEntries {
		oldestKey := ""
		oldestTime := int64(^uint64(0) >> 1)
		for candidate, entry := range c.entries {
			if entry.storedAt < oldestTime {
				oldestKey = candidate
				oldestTime = entry.storedAt
			}
		}
		delete(c.entries, oldestKey)
	}
	c.entries[key] = cacheEntry{value: value, storedAt: time.Now().UnixMilli()}
}

// CacheAllow applies a fixed-window limit to a key. It shares Cache's process-
// wide synchronized handle so callers do not need another mutable App field.
func CacheAllow(c *Cache, key string, max int, windowMs int64) bool {
	now := time.Now().UnixMilli()
	c.mu.Lock()
	defer c.mu.Unlock()
	window, exists := c.rateWindows[key]
	if !exists || now-window.startedAt >= windowMs {
		c.rateWindows[key] = rateWindow{startedAt: now, count: 1}
		return true
	}
	if window.count >= max {
		return false
	}
	window.count++
	c.rateWindows[key] = window
	return true
}
