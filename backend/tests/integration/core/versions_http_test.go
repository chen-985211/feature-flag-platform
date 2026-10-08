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

func TestPercentageAndVersionsHTTPContract(t *testing.T) {
	pool, _, _ := support.Database(t)
	hash, err := bcrypt.GenerateFromPassword([]byte("test-passphrase"), bcrypt.MinCost)
	if err != nil {
		t.Fatal(err)
	}
	for _, role := range []string{"admin", "viewer"} {
		if _, err = pool.Exec(t.Context(), `INSERT INTO users(id,username,password_hash,display_name,role) VALUES(gen_random_uuid(),$1,$2,$1,$1)`, role, string(hash)); err != nil {
			t.Fatal(err)
		}
	}
	handler, err := bootstrap.API(pool, config.Config{AppOrigin: "http://localhost:5173", SessionTTL: time.Hour}, slog.New(slog.NewTextHandler(io.Discard, nil)))
	if err != nil {
		t.Fatal(err)
	}
	request := func(method, path, body string, cookie *http.Cookie, csrf string) *httptest.ResponseRecorder {
		t.Helper()
		r := httptest.NewRequest(method, path, strings.NewReader(body))
		r.Header.Set("Content-Type", "application/json")
		r.Header.Set("Origin", "http://localhost:5173")
		if cookie != nil {
			r.AddCookie(cookie)
		}
		if csrf != "" {
			r.Header.Set("X-CSRF-Token", csrf)
		}
		w := httptest.NewRecorder()
		handler.ServeHTTP(w, r)
		return w
	}
	login := func(role string) (*http.Cookie, string) {
		t.Helper()
		w := request("POST", "/api/auth/login", `{"username":"`+role+`","password":"test-passphrase"}`, nil, "")
		if w.Code != 200 {
			t.Fatalf("login %d", w.Code)
		}
		var data struct {
			CSRF string `json:"csrf_token"`
		}
		if err := json.Unmarshal(w.Body.Bytes(), &data); err != nil {
			t.Fatal(err)
		}
		return w.Result().Cookies()[0], data.CSRF
	}
	admin, csrf := login("admin")
	w := request("POST", "/api/flags", `{"name":"Test","key":"test","environment":"development","enabled":true,"default_value":false}`, admin, csrf)
	var flag struct {
		ID       string `json:"id"`
		Revision int    `json:"revision"`
	}
	if w.Code != 201 || json.Unmarshal(w.Body.Bytes(), &flag) != nil {
		t.Fatalf("create %d %s", w.Code, w.Body.String())
	}
	path := "/api/flags/" + flag.ID
	w = request("POST", path+"/rules", `{"kind":"percentage","percentage_bp":10000,"priority":1,"result":false,"expected_revision":1}`, admin, csrf)
	if w.Code != 200 || !strings.Contains(w.Body.String(), `"percentage_bp":10000`) {
		t.Fatalf("percentage %d %s", w.Code, w.Body.String())
	}
	for _, body := range []string{`{"kind":"percentage","percentage_bp":10001,"priority":2,"result":true,"expected_revision":2}`, `{"kind":"percentage","priority":2,"result":true,"expected_revision":2}`, `{"kind":"percentage","percentage_bp":1.5,"priority":2,"result":true,"expected_revision":2}`, `{"kind":"percentage","percentage_bp":10,"attribute":"bad","priority":2,"result":true,"expected_revision":2}`} {
		w = request("POST", path+"/rules", body, admin, csrf)
		if w.Code != 400 {
			t.Fatalf("invalid percentage %d %s", w.Code, w.Body.String())
		}
	}
	w = request("POST", "/api/evaluations", `{"key":"test","environment":"development","attributes":{"user_id":"x"}}`, admin, "")
	var evaluation struct {
		Value   bool   `json:"value"`
		Source  string `json:"source"`
		Default bool   `json:"used_default"`
	}
	if w.Code != 200 || json.Unmarshal(w.Body.Bytes(), &evaluation) != nil || evaluation.Value || evaluation.Source != "percentage_rule" || evaluation.Default {
		t.Fatalf("false hit %d %s", w.Code, w.Body.String())
	}
	viewer, viewerCSRF := login("viewer")
	for _, url := range []string{path + "/versions", path + "/versions/2", path + "/versions/1/diff"} {
		w = request("GET", url, "", viewer, "")
		if w.Code != 200 {
			t.Fatalf("readonly %s %d %s", url, w.Code, w.Body.String())
		}
	}
	w = request("GET", path+"/versions/1/diff", "", viewer, "")
	var preview struct {
		Current int64 `json:"current_revision"`
		Source  int64 `json:"source_revision"`
		Changes []struct {
			Field  string `json:"field"`
			Before string `json:"before_json"`
			After  string `json:"after_json"`
		} `json:"changes"`
	}
	if json.Unmarshal(w.Body.Bytes(), &preview) != nil || preview.Current != 2 || preview.Source != 1 || len(preview.Changes) != 1 || preview.Changes[0].Field != "rules" {
		t.Fatalf("diff shape %d %s", w.Code, w.Body.String())
	}
	var rules []struct {
		Kind         string `json:"kind"`
		PercentageBP *int   `json:"percentage_bp"`
		ExpectedJSON string `json:"expected_json"`
	}
	if json.Unmarshal([]byte(preview.Changes[0].Before), &rules) != nil || len(rules) != 1 || rules[0].Kind != "percentage" || rules[0].PercentageBP == nil || *rules[0].PercentageBP != 10000 || rules[0].ExpectedJSON != "" || preview.Changes[0].After != "[]" {
		t.Fatalf("percentage diff must use the snapshot rule contract: %s", preview.Changes[0].Before)
	}
	w = request("POST", path+"/rollback", `{"source_revision":1,"expected_revision":2}`, viewer, viewerCSRF)
	if w.Code != 403 {
		t.Fatalf("viewer restore %d", w.Code)
	}
	w = request("POST", path+"/rollback", `{"source_revision":1,"expected_revision":2}`, admin, "")
	if w.Code != 403 {
		t.Fatalf("csrf restore %d", w.Code)
	}
	w = request("POST", path+"/rollback", `{"source_revision":1,"expected_revision":2}`, admin, csrf)
	if w.Code != 200 || !strings.Contains(w.Body.String(), `"revision":3`) || !strings.Contains(w.Body.String(), `"rules":[]`) {
		t.Fatalf("restore %d %s", w.Code, w.Body.String())
	}
	w = request("POST", path+"/rollback", `{"source_revision":2,"expected_revision":2}`, admin, csrf)
	if w.Code != 409 {
		t.Fatalf("old preview accepted %d", w.Code)
	}
	w = request("GET", path+"/versions/999", "", admin, "")
	if w.Code != 404 || !strings.Contains(w.Body.String(), "VERSION_NOT_FOUND") {
		t.Fatalf("missing version %d %s", w.Code, w.Body.String())
	}
}
