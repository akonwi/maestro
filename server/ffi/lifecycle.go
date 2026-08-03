package ffi

import (
	"context"
	"net/http"
	"time"
)

// ShutdownServer drains active HTTP requests until timeout. If the deadline is
// reached, remaining connections are closed so process shutdown cannot hang.
func ShutdownServer(server *http.Server, timeout time.Duration) error {
	ctx, cancel := context.WithTimeout(context.Background(), timeout)
	defer cancel()
	if err := server.Shutdown(ctx); err != nil {
		_ = server.Close()
		return err
	}
	return nil
}
