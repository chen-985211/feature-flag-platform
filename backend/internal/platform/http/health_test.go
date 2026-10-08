package httptransport_test

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	httptransport "didi/backend/internal/platform/http"
)

func TestReadinessReflectsDependencyAndDoesNotLeakErrors(t *testing.T) {
	for _, tc := range []struct {
		name string
		err  error
		want int
	}{
		{"ready", nil, http.StatusOK},
		{"unavailable", errors.New("postgresql://user:secret-value@private-host/database"), http.StatusServiceUnavailable},
	} {
		t.Run(tc.name, func(t *testing.T) {
			recorder := httptest.NewRecorder()
			httptransport.NewHandler(func(context.Context) error { return tc.err }, time.Second).ServeHTTP(recorder, httptest.NewRequest(http.MethodGet, "/health/ready", nil))
			if recorder.Code != tc.want {
				t.Fatalf("readiness status: got %d, want %d", recorder.Code, tc.want)
			}
			if !strings.Contains(recorder.Header().Get("Content-Type"), "application/json") {
				t.Fatal("readiness must return JSON")
			}
			if strings.Contains(recorder.Body.String(), "secret-value") || strings.Contains(recorder.Body.String(), "private-host") {
				t.Fatal("dependency error leaked")
			}
			var body struct {
				Status string `json:"status"`
				Error  *struct {
					Code      string `json:"code"`
					RequestID string `json:"request_id"`
				} `json:"error"`
			}
			if err := json.Unmarshal(recorder.Body.Bytes(), &body); err != nil {
				t.Fatal(err)
			}
			if tc.err == nil && body.Status != "ready" {
				t.Fatalf("unexpected readiness body: %s", recorder.Body.String())
			}
			if tc.err != nil && (body.Error == nil || body.Error.Code != "SERVICE_NOT_READY" || body.Error.RequestID == "" || body.Error.RequestID != recorder.Header().Get("X-Request-ID")) {
				t.Fatalf("missing stable correlated error: %s", recorder.Body.String())
			}
		})
	}
}

func TestLivenessDoesNotDependOnDatabase(t *testing.T) {
	called := false
	handler := httptransport.NewHandler(func(context.Context) error { called = true; return errors.New("unavailable") }, time.Second)
	r := httptest.NewRecorder()
	handler.ServeHTTP(r, httptest.NewRequest(http.MethodGet, "/health/live", nil))
	if r.Code != http.StatusOK || called {
		t.Fatalf("liveness must be independent of database; status=%d, probe called=%t", r.Code, called)
	}
}

func TestReadinessCancelsProbeOnTimeout(t *testing.T) {
	var probeError error
	handler := httptransport.NewHandler(func(ctx context.Context) error {
		<-ctx.Done()
		probeError = ctx.Err()
		return probeError
	}, time.Millisecond)
	r := httptest.NewRecorder()
	handler.ServeHTTP(r, httptest.NewRequest(http.MethodGet, "/health/ready", nil))
	if r.Code != http.StatusServiceUnavailable || !errors.Is(probeError, context.DeadlineExceeded) {
		t.Fatalf("timeout not delivered to probe: status=%d, error=%v", r.Code, probeError)
	}
}

func TestReadinessPropagatesRequestCancellation(t *testing.T) {
	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	var probeError error
	handler := httptransport.NewHandler(func(ctx context.Context) error { probeError = ctx.Err(); return probeError }, time.Second)
	r := httptest.NewRecorder()
	handler.ServeHTTP(r, httptest.NewRequest(http.MethodGet, "/health/ready", nil).WithContext(ctx))
	if r.Code != http.StatusServiceUnavailable || !errors.Is(probeError, context.Canceled) {
		t.Fatalf("request cancellation lost: status=%d, error=%v", r.Code, probeError)
	}
}
