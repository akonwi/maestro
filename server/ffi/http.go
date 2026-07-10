// Package ffi hosts Go-side helpers for the Ard server.
//
// This file covers HTTP/crypto utilities that are awkward to drive directly
// through Ard's Go interop (byte slices returned from io.ReadAll, filling a
// random buffer via crypto/rand.Read, hex-encoding, and later the auth
// middleware + context adapter for M3+).

package ffi

import (
	"crypto/rand"
	"encoding/hex"
	"io"
	"net/http"
	"strings"
)

// ReadBodyString reads the entire request body into a string. Callers should
// close the body (chi does via its default handler chain, but we don't rely
// on Go's automatic close here — io.ReadAll drains it).
func ReadBodyString(r *http.Request) (string, error) {
	b, err := io.ReadAll(r.Body)
	if err != nil {
		return "", err
	}
	return string(b), nil
}

// GenerateToken returns a URL-safe hex token of length 2*bytes characters.
// Sourced from crypto/rand.
func GenerateToken(bytes int) (string, error) {
	buf := make([]byte, bytes)
	if _, err := rand.Read(buf); err != nil {
		return "", err
	}
	return hex.EncodeToString(buf), nil
}

// BearerToken extracts the token from a Bearer Authorization header.
// Returns "" if the header is missing or malformed.
func BearerToken(r *http.Request) string {
	auth := r.Header.Get("Authorization")
	const prefix = "Bearer "
	if !strings.HasPrefix(auth, prefix) {
		return ""
	}
	return strings.TrimSpace(auth[len(prefix):])
}

// QueryParam reads a single query-string value.
func QueryParam(r *http.Request, name string) string {
	return r.URL.Query().Get(name)
}
