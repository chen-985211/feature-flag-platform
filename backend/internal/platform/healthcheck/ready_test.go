package healthcheck

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestReadinessResponseContract(t *testing.T) {
	for _, tc := range []struct {
		name, body string
		status     int
		ready      bool
	}{
		{"ready", `{"status":"ready"}`, 200, true},
		{"unavailable", `{"error":{"code":"SERVICE_NOT_READY"}}`, 503, false},
		{"alive is insufficient", `{"status":"alive"}`, 200, false},
		{"invalid response", `not-json`, 200, false},
	} {
		t.Run(tc.name, func(t *testing.T) {
			server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				if r.Method != http.MethodGet || r.URL.Path != "/health/ready" {
					t.Error("wrong health request")
				}
				w.WriteHeader(tc.status)
				if _, err := w.Write([]byte(tc.body)); err != nil {
					t.Error(err)
				}
			}))
			defer server.Close()
			if err := Ready(t.Context(), server.URL+"/health/ready"); (err == nil) != tc.ready {
				t.Fatalf("readiness %v expected %t", err, tc.ready)
			}
		})
	}
}
func TestReadinessHonorsCancellationAndUnavailableEndpoint(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) { t.Error("cancelled check sent a request") }))
	ctx, cancel := context.WithCancel(t.Context())
	cancel()
	if err := Ready(ctx, server.URL); err == nil {
		t.Fatal("cancelled check accepted")
	}
	server.Close()
	if err := Ready(t.Context(), server.URL); err == nil {
		t.Fatal("unavailable endpoint accepted")
	}
}
