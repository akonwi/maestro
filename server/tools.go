//go:build tools

// This file exists only to pin Go module dependencies that are imported by
// Ard-generated code (chi) rather than by hand-written Go, so that
// `go mod tidy` keeps them and records their full go.sum closure.
//
// It is excluded from normal builds by the `tools` build tag.
package tools

import (
	_ "github.com/go-chi/chi/v5"
	_ "github.com/go-chi/chi/v5/middleware"
	_ "modernc.org/sqlite"
)
