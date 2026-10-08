package core_test

import (
	"didi/backend/internal/platform/bootstrap"
	"didi/backend/internal/platform/config"
	"didi/backend/tests/support"
	"encoding/json"
	"golang.org/x/crypto/bcrypt"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"
)

func TestTransferHTTPAndTargetPermissions(t *testing.T) {
	pool, _, _ := support.Database(t)
	hash, err := bcrypt.GenerateFromPassword([]byte("test-passphrase"), bcrypt.MinCost)
	if err != nil {
		t.Fatal(err)
	}
	for _, role := range []string{"admin", "editor", "viewer"} {
		if _, err = pool.Exec(t.Context(), `INSERT INTO users(id,username,password_hash,display_name,role) VALUES(gen_random_uuid(),$1,$2,$1,$1)`, role, string(hash)); err != nil {
			t.Fatal(err)
		}
	}
	handler, err := bootstrap.API(pool, config.Config{AppOrigin: "http://localhost:5173", SessionTTL: time.Hour}, slog.New(slog.NewTextHandler(io.Discard, nil)))
	if err != nil {
		t.Fatal(err)
	}
	request := func(method, path, body string, cookie *http.Cookie, token, origin string) *httptest.ResponseRecorder {
		t.Helper()
		r := httptest.NewRequest(method, path, strings.NewReader(body))
		r.Header.Set("Content-Type", "application/json")
		r.Header.Set("Origin", origin)
		if cookie != nil {
			r.AddCookie(cookie)
		}
		r.Header.Set("X-CSRF-Token", token)
		w := httptest.NewRecorder()
		handler.ServeHTTP(w, r)
		return w
	}
	login := func(role string) (*http.Cookie, string) {
		t.Helper()
		w := request("POST", "/api/auth/login", `{"username":"`+role+`","password":"test-passphrase"}`, nil, "", "http://localhost:5173")
		if w.Code != 200 {
			t.Fatalf("login %d", w.Code)
		}
		var v struct {
			CSRF string `json:"csrf_token"`
		}
		if json.Unmarshal(w.Body.Bytes(), &v) != nil {
			t.Fatal("login response")
		}
		return w.Result().Cookies()[0], v.CSRF
	}
	admin, csrf := login("admin")
	editor, editorCSRF := login("editor")
	viewer, viewerCSRF := login("viewer")
	w := request("POST", "/api/flags", `{"name":"Source","key":"http-transfer","environment":"development","enabled":true,"default_value":true}`, admin, csrf, "http://localhost:5173")
	var source struct {
		ID string `json:"id"`
	}
	if w.Code != 201 || json.Unmarshal(w.Body.Bytes(), &source) != nil {
		t.Fatal("source setup")
	}
	path := "/api/flags/" + source.ID
	w = request("GET", path+"/versions/1/publication?target_environment=staging", "", viewer, "", "")
	if w.Code != 404 || !strings.Contains(w.Body.String(), "TARGET_NOT_FOUND") {
		t.Fatalf("missing target %d %s", w.Code, w.Body.String())
	}
	w = request("POST", path+"/copy", `{"source_revision":1,"target_environment":"staging"}`, editor, editorCSRF, "http://localhost:5173")
	var target struct {
		ID          string `json:"id"`
		Environment string `json:"environment"`
		Revision    int    `json:"revision"`
	}
	if w.Code != 201 || json.Unmarshal(w.Body.Bytes(), &target) != nil || target.ID == source.ID || target.Environment != "staging" || target.Revision != 1 {
		t.Fatalf("editor copy %d %s", w.Code, w.Body.String())
	}
	w = request("POST", path+"/copy", `{"source_revision":1,"target_environment":"production"}`, admin, csrf, "http://localhost:5173")
	var production struct {
		ID string `json:"id"`
	}
	if w.Code != 201 || json.Unmarshal(w.Body.Bytes(), &production) != nil {
		t.Fatalf("production copy %d %s", w.Code, w.Body.String())
	}
	for _, role := range []struct {
		name   string
		cookie *http.Cookie
		token  string
	}{{"editor", editor, editorCSRF}, {"viewer", viewer, viewerCSRF}} {
		for _, mutation := range []struct{ path, body string }{{"/api/flags/" + production.ID + "/rules/order", `{"rule_ids":[],"expected_revision":1}`}, {path + "/copy", `{"source_revision":1,"target_environment":"production"}`}, {path + "/publish", `{"source_revision":1,"target_id":"` + production.ID + `","expected_revision":1}`}} {
			w = request("POST", mutation.path, mutation.body, role.cookie, role.token, "http://localhost:5173")
			if w.Code != 403 {
				t.Errorf("%s bypass %s: %d %s", role.name, mutation.path, w.Code, w.Body.String())
			}
		}
	}
	for _, mutation := range []struct{ path, body string }{{path + "/rules/order", `{"rule_ids":[],"expected_revision":1}`}, {path + "/copy", `{"source_revision":1,"target_environment":"staging"}`}, {path + "/publish", `{"source_revision":1,"target_id":"` + target.ID + `","expected_revision":1}`}} {
		for _, boundary := range []struct {
			cookie        *http.Cookie
			token, origin string
			status        int
		}{{nil, "", "http://localhost:5173", 401}, {admin, "", "http://localhost:5173", 403}, {admin, csrf, "http://evil.test", 403}, {viewer, viewerCSRF, "http://localhost:5173", 403}} {
			w = request("POST", mutation.path, mutation.body, boundary.cookie, boundary.token, boundary.origin)
			if w.Code != boundary.status {
				t.Errorf("boundary %s: %d wanted %d", mutation.path, w.Code, boundary.status)
			}
		}
	}
	w = request("GET", path+"/versions/1/publication?target_environment=staging", "", viewer, "", "")
	var preview struct {
		SourceRevision int `json:"source_revision"`
		TargetRevision int `json:"target_revision"`
		Target         struct {
			ID string `json:"id"`
		} `json:"target"`
	}
	if w.Code != 200 || json.Unmarshal(w.Body.Bytes(), &preview) != nil || preview.SourceRevision != 1 || preview.TargetRevision != 1 || preview.Target.ID != target.ID {
		t.Fatalf("readonly preview %d %s", w.Code, w.Body.String())
	}
	w = request("POST", path+"/publish", `{"source_revision":1,"target_id":"`+target.ID+`","expected_revision":1}`, editor, editorCSRF, "http://localhost:5173")
	if w.Code != 200 || !strings.Contains(w.Body.String(), `"revision":2`) {
		t.Fatalf("editor publish %d %s", w.Code, w.Body.String())
	}
	w = request("POST", path+"/publish", `{"source_revision":1,"target_id":"`+target.ID+`","expected_revision":1}`, admin, csrf, "http://localhost:5173")
	if w.Code != 409 {
		t.Fatalf("stale target %d", w.Code)
	}
	w = request("POST", path+"/rules/order", `{"rule_ids":[],"expected_revision":1}`, editor, editorCSRF, "http://localhost:5173")
	if w.Code != 200 || !strings.Contains(w.Body.String(), `"revision":2`) {
		t.Fatalf("editor order %d %s", w.Code, w.Body.String())
	}
	w = request("POST", path+"/rules/order", `{"rule_ids":null,"expected_revision":2}`, admin, csrf, "http://localhost:5173")
	if w.Code != 400 {
		t.Fatalf("null sequence %d", w.Code)
	}
}
