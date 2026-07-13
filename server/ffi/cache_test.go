package ffi

import (
	"testing"
	"time"
)

func TestCache_MissThenHit(t *testing.T) {
	c := NewCache()

	if got, ok := CacheGet(c, "k", 1000); ok {
		t.Fatalf("expected miss, got %q", got)
	}

	CachePut(c, "k", `{"a":1}`)
	if got, ok := CacheGet(c, "k", 1000); !ok || got != `{"a":1}` {
		t.Fatalf("expected hit, got %q (ok=%v)", got, ok)
	}
}

func TestCache_StaleEntryMisses(t *testing.T) {
	c := NewCache()
	CachePut(c, "k", "v")

	// Entry stored now; a 0ms max age must treat it as stale.
	time.Sleep(2 * time.Millisecond)
	if got, ok := CacheGet(c, "k", 0); ok {
		t.Fatalf("expected stale miss, got %q", got)
	}

	// A fresh put replaces the timestamp.
	CachePut(c, "k", "v2")
	if got, ok := CacheGet(c, "k", 10_000); !ok || got != "v2" {
		t.Fatalf("expected fresh value, got %q (ok=%v)", got, ok)
	}
}

func TestCache_EvictsWhenBoundedCapacityIsReached(t *testing.T) {
	c := NewCache()
	for i := 0; i < maxCacheEntries+1; i++ {
		CachePut(c, string(rune(i)), "value")
	}
	if len(c.entries) != maxCacheEntries {
		t.Fatalf("expected %d entries, got %d", maxCacheEntries, len(c.entries))
	}
}

func TestCacheAllow_LimitsAndResetsAWindow(t *testing.T) {
	c := NewCache()
	if !CacheAllow(c, "user:1", 2, 10) || !CacheAllow(c, "user:1", 2, 10) {
		t.Fatal("expected first two requests to pass")
	}
	if CacheAllow(c, "user:1", 2, 10) {
		t.Fatal("expected third request to be limited")
	}
	time.Sleep(11 * time.Millisecond)
	if !CacheAllow(c, "user:1", 2, 10) {
		t.Fatal("expected new window to pass")
	}
}
