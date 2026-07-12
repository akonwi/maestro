package ffi

import (
	"context"
	"net/http"
)

type userIDKey struct{}

// AuthMiddleware adapts an Ard session lookup callback into standard chi
// middleware and stores the authenticated user id in the request context.
func AuthMiddleware(authenticate func(*http.Request) (int, bool)) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			userID, ok := authenticate(r)
			if !ok {
				w.Header().Set("Content-Type", "application/json")
				w.WriteHeader(http.StatusUnauthorized)
				_, _ = w.Write([]byte(`{"error":"missing, invalid, or expired bearer token"}`))
				return
			}

			ctx := context.WithValue(r.Context(), userIDKey{}, userID)
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}

// UserID retrieves the identity established by AuthMiddleware.
func UserID(r *http.Request) (int, bool) {
	userID, ok := r.Context().Value(userIDKey{}).(int)
	return userID, ok
}
