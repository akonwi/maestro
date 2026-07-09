// Package ffi hosts the Go-side database support for the Ard server.
//
// Ard cannot drive Go's database/sql directly: Query/Exec take a variadic
// ...any and Scan takes pointer-out arguments, both of which are outside
// Ard's current Go-interop surface. This package exposes a small, value-in /
// value-out API that the Ard `sql` module (sql.ard) wraps.
//
// The DB handle is opaque to Ard: it is constructed only via Open and passed
// back to the other functions. Its fields are unexported so Ard never reads
// or builds one directly.
package ffi

import (
	"database/sql"

	_ "modernc.org/sqlite"
)

// DB is an opaque handle around a *sql.DB.
type DB struct {
	inner *sql.DB
}

// Open opens (and verifies) a SQLite database at path. The pure-Go
// "sqlite" driver is registered by the modernc.org/sqlite import above,
// so no CGO is required.
func Open(path string) (*DB, error) {
	inner, err := sql.Open("sqlite", path)
	if err != nil {
		return nil, err
	}
	if err := inner.Ping(); err != nil {
		inner.Close()
		return nil, err
	}
	// SQLite is single-writer; keep the pool small and predictable.
	inner.SetMaxOpenConns(1)
	return &DB{inner: inner}, nil
}

// Ping verifies the connection is still alive.
func Ping(db *DB) error {
	return db.inner.Ping()
}

// Close releases the underlying pool.
func Close(db *DB) error {
	return db.inner.Close()
}

// Exec runs a statement that returns no rows. args are bound positionally
// against ? placeholders.
func Exec(db *DB, query string, args []any) error {
	_, err := db.inner.Exec(query, args...)
	return err
}

// Query runs a statement and returns all rows as a slice of column->value
// maps. []byte values are converted to strings so they arrive as Ard Str.
func Query(db *DB, query string, args []any) ([]map[string]any, error) {
	rows, err := db.inner.Query(query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	cols, err := rows.Columns()
	if err != nil {
		return nil, err
	}

	var out []map[string]any
	for rows.Next() {
		values := make([]any, len(cols))
		pointers := make([]any, len(cols))
		for i := range values {
			pointers[i] = &values[i]
		}
		if err := rows.Scan(pointers...); err != nil {
			return nil, err
		}
		row := make(map[string]any, len(cols))
		for i, col := range cols {
			v := values[i]
			if b, ok := v.([]byte); ok {
				v = string(b)
			}
			row[col] = v
		}
		out = append(out, row)
	}
	return out, rows.Err()
}
