package core_test

import (
	"bytes"
	identityInfra "didi/backend/internal/contexts/identity/infrastructure"
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

func TestHTTPIdentityAndPermissionBoundary(t *testing.T) {
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
	request := func(method, path, body string, cookie *http.Cookie, csrf, origin string) *httptest.ResponseRecorder {
		t.Helper()
		r := httptest.NewRequest(method, path, strings.NewReader(body))
		r.Header.Set("Content-Type", "application/json")
		if cookie != nil {
			r.AddCookie(cookie)
		}
		if csrf != "" {
			r.Header.Set("X-CSRF-Token", csrf)
		}
		if origin != "" {
			r.Header.Set("Origin", origin)
		}
		w := httptest.NewRecorder()
		handler.ServeHTTP(w, r)
		return w
	}
	if w := request("GET", "/api/flags?environment=development", "", nil, "", ""); w.Code != 401 {
		t.Fatalf("anonymous: %d", w.Code)
	}
	login := func(role, password string) (*http.Cookie, string) {
		t.Helper()
		w := request("POST", "/api/auth/login", `{"username":"`+role+`","password":"`+password+`"}`, nil, "", "http://localhost:5173")
		if w.Code != 200 {
			t.Fatalf("login %s %d %s", role, w.Code, w.Body.String())
		}
		var body struct {
			CSRF string `json:"csrf_token"`
		}
		if err := json.Unmarshal(w.Body.Bytes(), &body); err != nil {
			t.Fatal(err)
		}
		cookies := w.Result().Cookies()
		if len(cookies) != 1 || !cookies[0].HttpOnly || cookies[0].SameSite != http.SameSiteLaxMode || cookies[0].Secure || cookies[0].Path != "/" {
			t.Fatalf("cookie flags")
		}
		return cookies[0], body.CSRF
	}
	wrong := request("POST", "/api/auth/login", `{"username":"admin","password":"wrong"}`, nil, "", "http://localhost:5173")
	missing := request("POST", "/api/auth/login", `{"username":"unknown","password":"wrong"}`, nil, "", "http://localhost:5173")
	if wrong.Code != 401 || missing.Code != 401 {
		t.Fatalf("generic credentials %d %d", wrong.Code, missing.Code)
	}
	var wrongBody, missingBody map[string]map[string]string
	if err = json.Unmarshal(wrong.Body.Bytes(), &wrongBody); err != nil {
		t.Fatal(err)
	}
	if err = json.Unmarshal(missing.Body.Bytes(), &missingBody); err != nil {
		t.Fatal(err)
	}
	if wrongBody["error"]["code"] != missingBody["error"]["code"] || wrongBody["error"]["message"] != missingBody["error"]["message"] {
		t.Fatal("account existence disclosure")
	}
	admin, csrf := login("admin", "test-passphrase")
	create := `{"name":"Checkout","key":"checkout","environment":"production","enabled":true,"default_value":false}`
	for _, tc := range []struct{ name, token, origin string }{{"no csrf", "", "http://localhost:5173"}, {"wrong csrf", "forged", "http://localhost:5173"}, {"foreign", csrf, "http://evil.test"}} {
		w := request("POST", "/api/flags", create, admin, tc.token, tc.origin)
		if w.Code != 403 {
			t.Fatalf("%s: %d", tc.name, w.Code)
		}
	}
	w := request("POST", "/api/flags", create, admin, csrf, "http://localhost:5173")
	if w.Code != 201 {
		t.Fatalf("create %d %s", w.Code, w.Body.String())
	}
	var flag struct {
		ID       string `json:"id"`
		Revision int    `json:"revision"`
	}
	if err = json.Unmarshal(w.Body.Bytes(), &flag); err != nil {
		t.Fatal(err)
	}
	for _, role := range []string{"viewer", "editor"} {
		cookie, token := login(role, "test-passphrase")
		for _, mutation := range []struct{ method, path, body string }{
			{"POST", "/api/flags", strings.Replace(create, "checkout", "other-"+role, 1)},
			{"PUT", "/api/flags/" + flag.ID, `{"name":"Attempt","key":"checkout","default_value":false,"expected_revision":1}`},
			{"PATCH", "/api/flags/" + flag.ID + "/enabled", `{"enabled":false,"expected_revision":1}`},
			{"POST", "/api/flags/" + flag.ID + "/rules", `{"attribute":"country","operator":"equals","expected":"cn","priority":1,"result":true,"expected_revision":1}`},
			{"PUT", "/api/flags/" + flag.ID + "/rules/00000000-0000-4000-8000-000000000099", `{"attribute":"country","operator":"equals","expected":"cn","priority":1,"result":true,"expected_revision":1}`},
			{"DELETE", "/api/flags/" + flag.ID + "/rules/00000000-0000-4000-8000-000000000099", `{"expected_revision":1}`},
		} {
			r := request(mutation.method, mutation.path, mutation.body, cookie, token, "http://localhost:5173")
			if r.Code != 403 {
				t.Errorf("%s %s %s: %d %s", role, mutation.method, mutation.path, r.Code, r.Body.String())
			}
		}
		eval := request("POST", "/api/evaluations", `{"key":"checkout","environment":"production","attributes":{}}`, cookie, "", "")
		if eval.Code != 200 {
			t.Errorf("readonly evaluation %d", eval.Code)
		}
	}
	forged := request("PUT", "/api/flags/"+flag.ID, `{"name":"Changed","key":"checkout","default_value":false,"expected_revision":1,"actor_id":"fake"}`, admin, csrf, "http://localhost:5173")
	if forged.Code != 400 {
		t.Fatalf("forged actor %d", forged.Code)
	}
	for _, attrs := range []string{`null`, `[]`, `1`} {
		r := request("POST", "/api/evaluations", `{"key":"checkout","environment":"production","attributes":`+attrs+`}`, admin, "", "")
		if r.Code != 400 {
			t.Errorf("invalid attrs %s %d", attrs, r.Code)
		}
	}
	if _, err = pool.Exec(t.Context(), `UPDATE users SET role='viewer' WHERE username='admin'`); err != nil {
		t.Fatal(err)
	}
	changed := request("PATCH", "/api/flags/"+flag.ID+"/enabled", `{"enabled":false,"expected_revision":1}`, admin, csrf, "http://localhost:5173")
	if changed.Code != 403 {
		t.Fatal("cached role trusted")
	}
	history := request("GET", "/api/flags/"+flag.ID+"/history", "", admin, "", "")
	if history.Code != 200 || !bytes.Contains(history.Body.Bytes(), []byte(`"actor_name":"admin"`)) {
		t.Fatalf("history %d %s", history.Code, history.Body.String())
	}
	if out := request("POST", "/api/auth/logout", "", admin, csrf, "http://localhost:5173"); out.Code != 204 {
		t.Fatalf("logout %d", out.Code)
	}
	if out := request("GET", "/api/auth/session", "", admin, "", ""); out.Code != 401 {
		t.Fatal("revoked session accepted")
	}
	var versions, audits int
	if err = pool.QueryRow(t.Context(), `SELECT (SELECT count(*) FROM flag_versions),(SELECT count(*) FROM audit_entries)`).Scan(&versions, &audits); err != nil || versions != 1 || audits != 1 {
		t.Fatalf("rejected or readonly writes %d %d %v", versions, audits, err)
	}
}

func TestSessionExpirySecureCookieAndIdempotentSeed(t *testing.T) {
	pool, _, _ := support.Database(t)
	repo := identityInfra.Repository{Pool: pool}
	ctx := t.Context()
	if err := repo.SeedUser(ctx, "editor", "Original", "editor", "original-passphrase"); err != nil {
		t.Fatal(err)
	}
	if err := repo.SeedUser(ctx, "editor", "Changed", "admin", "new-passphrase"); err != nil {
		t.Fatal(err)
	}
	user, err := repo.User(ctx, "editor")
	if err != nil || user.Name != "Original" || user.Role != "editor" || !(identityInfra.Passwords{}).Verify(user.PasswordHash, "original-passphrase") {
		t.Fatalf("seed reset user: %v", err)
	}
	handler, err := bootstrap.API(pool, config.Config{AppOrigin: "https://workbench.test", SessionTTL: time.Hour}, slog.New(slog.NewTextHandler(io.Discard, nil)))
	if err != nil {
		t.Fatal(err)
	}
	r := httptest.NewRequest("POST", "/api/auth/login", strings.NewReader(`{"username":"editor","password":"original-passphrase"}`))
	r.Header.Set("Origin", "https://workbench.test")
	r.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	handler.ServeHTTP(w, r)
	if w.Code != 200 {
		t.Fatalf("login %d", w.Code)
	}
	cookies := w.Result().Cookies()
	if len(cookies) != 1 || !cookies[0].Secure || cookies[0].MaxAge != 3600 {
		t.Fatal("HTTPS cookie lacks Secure or TTL")
	}
	if _, err = pool.Exec(ctx, `UPDATE sessions SET created_at=now()-interval '2 hours',expires_at=now()-interval '1 hour'`); err != nil {
		t.Fatal(err)
	}
	r = httptest.NewRequest("GET", "/api/auth/session", nil)
	r.AddCookie(cookies[0])
	w = httptest.NewRecorder()
	handler.ServeHTTP(w, r)
	if w.Code != 401 {
		t.Fatalf("expired session accepted %d", w.Code)
	}
}
