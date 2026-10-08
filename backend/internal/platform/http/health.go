package httptransport

import (
	"context"
	"crypto/rand"
	"encoding/json"
	"net/http"
	"time"
)

type Probe func(context.Context) error

func NewHandler(probe Probe, timeout time.Duration) http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("GET /health/live", func(w http.ResponseWriter, r *http.Request) {
		writeJSON(w, http.StatusOK, map[string]string{"status": "alive"})
	})
	mux.HandleFunc("GET /health/ready", func(w http.ResponseWriter, r *http.Request) {
		ctx, cancel := context.WithTimeout(r.Context(), timeout)
		defer cancel()
		if probe == nil || probe(ctx) != nil || ctx.Err() != nil {
			writeJSON(w, http.StatusServiceUnavailable, errorResponse{Error: errorDetails{
				Code: "SERVICE_NOT_READY", Message: "Service is not ready", RequestID: w.Header().Get("X-Request-ID"),
			}})
			return
		}
		writeJSON(w, http.StatusOK, map[string]string{"status": "ready"})
	})
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("X-Request-ID", rand.Text())
		w.Header().Set("Cache-Control", "no-store")
		mux.ServeHTTP(w, r)
	})
}

type errorResponse struct {
	Error errorDetails `json:"error"`
}

type errorDetails struct {
	Code      string `json:"code"`
	Message   string `json:"message"`
	RequestID string `json:"request_id"`
}

func writeJSON(w http.ResponseWriter, status int, value any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	if err := json.NewEncoder(w).Encode(value); err != nil {
		// Headers are already committed; the client may have disconnected. Do not attempt a second response.
		return
	}
}
