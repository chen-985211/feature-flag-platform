package support

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"net/url"
	"os"
	"strings"
	"testing"
	"time"

	"didi/backend/migrations"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

func Database(t *testing.T) (*pgxpool.Pool, string, string) {
	t.Helper()
	raw := os.Getenv("TEST_DATABASE_URL")
	parsed, err := url.Parse(raw)
	if err != nil || parsed == nil || (parsed.Scheme != "postgres" && parsed.Scheme != "postgresql") || !strings.HasSuffix(strings.TrimPrefix(parsed.Path, "/"), "_test") {
		t.Fatal("TEST_DATABASE_URL must explicitly target a PostgreSQL database ending in _test")
	}
	if development, err := url.Parse(os.Getenv("DATABASE_URL")); err == nil && development != nil && parsed.Path == development.Path {
		t.Fatal("test and development databases must differ")
	}
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	admin, err := pgxpool.New(ctx, raw)
	if err != nil {
		t.Fatal("invalid test database settings")
	}
	t.Cleanup(admin.Close)
	bytes := make([]byte, 12)
	if _, err := rand.Read(bytes); err != nil {
		t.Fatal(err)
	}
	schema := "didi_test_" + hex.EncodeToString(bytes)
	quoted := pgx.Identifier{schema}.Sanitize()
	if _, err := admin.Exec(ctx, "CREATE SCHEMA "+quoted); err != nil {
		t.Fatal("test database unavailable or missing schema creation permission")
	}
	t.Cleanup(func() {
		cleanupCtx, stop := context.WithTimeout(context.Background(), 10*time.Second)
		defer stop()
		if _, err := admin.Exec(cleanupCtx, "DROP SCHEMA "+quoted+" CASCADE"); err != nil {
			t.Errorf("failed to clean owned test schema: %v", err)
		}
	})
	cfg, err := pgxpool.ParseConfig(raw)
	if err != nil {
		t.Fatal("invalid test database settings")
	}
	cfg.ConnConfig.RuntimeParams["search_path"] = schema
	cfg.ConnConfig.RuntimeParams["statement_timeout"] = "5000"
	pool, err := pgxpool.NewWithConfig(ctx, cfg)
	if err != nil {
		t.Fatal("failed to create isolated pool")
	}
	t.Cleanup(pool.Close)
	if err := migrations.Apply(raw, schema, 0); err != nil {
		t.Fatalf("apply migration: %v", err)
	}
	return pool, raw, schema
}
