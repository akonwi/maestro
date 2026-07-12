package ffi

import (
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestAuthMiddlewareRejectsUnauthenticatedRequests(t *testing.T) {
	handler := AuthMiddleware(func(*http.Request) (int, bool) { return 0, false })(
		http.HandlerFunc(func(http.ResponseWriter, *http.Request) {
			t.Fatal("protected handler should not run")
		}),
	)

	response := httptest.NewRecorder()
	handler.ServeHTTP(response, httptest.NewRequest(http.MethodGet, "/auth/me", nil))

	if response.Code != http.StatusUnauthorized {
		t.Fatalf("status = %d, want 401", response.Code)
	}
	if got := response.Body.String(); got != `{"error":"missing, invalid, or expired bearer token"}` {
		t.Fatalf("body = %q", got)
	}
}

func TestAuthMiddlewareStoresUserID(t *testing.T) {
	handler := AuthMiddleware(func(*http.Request) (int, bool) { return 42, true })(
		http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			id, ok := UserID(r)
			if !ok || id != 42 {
				t.Fatalf("UserID = (%d, %v), want (42, true)", id, ok)
			}
			w.WriteHeader(http.StatusNoContent)
		}),
	)

	response := httptest.NewRecorder()
	handler.ServeHTTP(response, httptest.NewRequest(http.MethodGet, "/auth/me", nil))
	if response.Code != http.StatusNoContent {
		t.Fatalf("status = %d, want 204", response.Code)
	}
}
