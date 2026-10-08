package web

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"testing/fstest"
)

func TestStaticAssetsAndSPAFallback(t *testing.T) {
	files := fstest.MapFS{"index.html": {Data: []byte("<html>workbench</html>")}, "assets/app-123.js": {Data: []byte("console.log('app')")}}
	for _, test := range []struct {
		path, accept, method string
		code                 int
		contains             string
	}{
		{"/", "text/html", "GET", 200, "workbench"},
		{"/flags/example", "text/html", "GET", 200, "workbench"},
		{"/assets/app-123.js", "*/*", "GET", 200, "console.log"},
		{"/assets/missing.js", "*/*", "GET", 404, ""},
		{"/api/missing", "text/html", "GET", 404, ""},
		{"/.gitkeep", "*/*", "GET", 404, ""},
		{"/", "text/html", "POST", 405, ""},
	} {
		t.Run(test.method+test.path, func(t *testing.T) {
			request := httptest.NewRequest(test.method, test.path, nil)
			request.Header.Set("Accept", test.accept)
			response := httptest.NewRecorder()
			NewHandler(files).ServeHTTP(response, request)
			if response.Code != test.code || !strings.Contains(response.Body.String(), test.contains) {
				t.Fatalf("unexpected response: %d %s", response.Code, response.Body.String())
			}
		})
	}
}
func TestMissingBuildAssetsAreExplicit(t *testing.T) {
	response := httptest.NewRecorder()
	NewHandler(fstest.MapFS{}).ServeHTTP(response, httptest.NewRequest("GET", "/", nil))
	if response.Code != http.StatusServiceUnavailable {
		t.Fatalf("expected 503 when frontend was not built, got %d", response.Code)
	}
}
