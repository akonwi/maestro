//go:build tools

// Pin Go dependencies that are only imported by Ard-generated code so
// `go mod tidy` retains them and records their full go.sum closure.
//
// Excluded from normal builds by the `tools` build tag.
package tools

import (
	_ "github.com/akonwi/ard-sql/ffi"
)
