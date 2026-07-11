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
