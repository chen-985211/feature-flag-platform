package demo_test

import (
	identity "didi/backend/internal/contexts/identity/infrastructure"
	"didi/backend/tests/support"
	"net/url"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"testing"
)

func TestSeedCLIInitializesRealDemoAndPreservesExistingAccounts(t *testing.T) {
	pool, raw, schema := support.Database(t)
	backend, err := filepath.Abs("../../..")
	if err != nil {
		t.Fatal(err)
	}
	binary := filepath.Join(t.TempDir(), "didi-seed")
	build := exec.CommandContext(t.Context(), "go", "build", "-o", binary, "./cmd/seed")
	build.Dir = backend
	if output, err := build.CombinedOutput(); err != nil {
		t.Fatalf("seed build failed: %s", output)
	}
	parsed, err := url.Parse(raw)
	if err != nil {
		t.Fatal("invalid test configuration")
	}
	query := parsed.Query()
	query.Set("search_path", schema)
	parsed.RawQuery = query.Encode()
	password := (identity.Tokens{}).New()
	run := func(mode, adminPassword string, wantSuccess bool) string {
		t.Helper()
		cmd := exec.CommandContext(t.Context(), binary, mode)
		cmd.Env = append(os.Environ(), "DATABASE_URL="+parsed.String(), "SEED_ADMIN_PASSWORD="+adminPassword, "SEED_EDITOR_PASSWORD="+password, "SEED_VIEWER_PASSWORD="+password)
		output, err := cmd.CombinedOutput()
		if wantSuccess != (err == nil) {
			t.Fatalf("seed exit mismatch: %s", output)
		}
		if strings.Contains(string(output), password) || strings.Contains(string(output), raw) {
			t.Fatal("seed exposed sensitive input")
		}
		return string(output)
	}
	first := run("demo", password, true)
	if !strings.Contains(first, "created=5 preserved=0") {
		t.Fatalf("demo did not initialize: %s", first)
	}
	var flags, versions, audits, rules, users int
	counts := func() {
		t.Helper()
		if err := pool.QueryRow(t.Context(), `SELECT (SELECT count(*) FROM flags),(SELECT count(*) FROM flag_versions),(SELECT count(*) FROM audit_entries),(SELECT count(*) FROM rules),(SELECT count(*) FROM users)`).Scan(&flags, &versions, &audits, &rules, &users); err != nil || flags != 5 || versions != 5 || audits != 5 || rules != 5 || users != 3 {
			t.Fatalf("incomplete CLI data %d/%d/%d/%d/%d: %v", flags, versions, audits, rules, users, err)
		}
	}
	counts()
	repository := identity.Repository{Pool: pool}
	before, err := repository.User(t.Context(), "admin")
	if err != nil || !(identity.Passwords{}).Verify(before.PasswordHash, password) {
		t.Fatal("admin credential unavailable")
	}
	var validAudit int
	if err := pool.QueryRow(t.Context(), `SELECT count(*) FROM audit_entries WHERE actor_id=$1 AND actor_name=$2 AND changes->'before'='null'::jsonb AND changes->'after'->>'SchemaVersion'='1' AND request_id <> ''`, before.ID, before.Name).Scan(&validAudit); err != nil || validAudit != 5 {
		t.Fatalf("audit missing real actor/configuration %d %v", validAudit, err)
	}
	if _, err := pool.Exec(t.Context(), `UPDATE users SET display_name='Custom Admin' WHERE username='admin'; UPDATE users SET role='admin',display_name='Custom Viewer' WHERE username='viewer'`); err != nil {
		t.Fatal(err)
	}
	repeat := run("demo", (identity.Tokens{}).New(), true)
	if !strings.Contains(repeat, "created=0 preserved=5") {
		t.Fatalf("repeat: %s", repeat)
	}
	after, err := repository.User(t.Context(), "admin")
	viewer, viewerErr := repository.User(t.Context(), "viewer")
	if err != nil || viewerErr != nil || after.PasswordHash != before.PasswordHash || after.Name != "Custom Admin" || viewer.Role != "admin" || viewer.Name != "Custom Viewer" {
		t.Fatal("seed reset existing credentials/name/role")
	}
	counts()
	if _, err := pool.Exec(t.Context(), `UPDATE users SET role='viewer' WHERE username='admin'`); err != nil {
		t.Fatal(err)
	}
	if output := run("demo", password, false); !strings.Contains(output, "SEED_FORBIDDEN") {
		t.Fatalf("role bypass diagnostic: %s", output)
	}
	counts()
	run("unknown", password, false)
	run("demo", "short", false)
	counts()
}
