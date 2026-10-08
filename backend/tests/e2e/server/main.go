package main

import (
	"context"
	"crypto/rand"
	identity "didi/backend/internal/contexts/identity/infrastructure"
	"didi/backend/internal/platform/bootstrap"
	"didi/backend/internal/platform/config"
	transport "didi/backend/internal/platform/http"
	"didi/backend/internal/platform/web"
	"didi/backend/migrations"
	"encoding/hex"
	"errors"
	"fmt"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"log/slog"
	"net/http"
	"net/url"
	"os"
	"os/signal"
	"strings"
	"syscall"
	"time"
)

func main() {
	if err := run(); err != nil {
		fmt.Fprintln(os.Stderr, "E2E_SERVER_FAILED: verify test database, credentials, assets and free port 18090")
		os.Exit(1)
	}
}
func run() (retErr error) {
	raw := os.Getenv("TEST_DATABASE_URL")
	parsed, err := url.Parse(raw)
	if err != nil || parsed == nil || (parsed.Scheme != "postgres" && parsed.Scheme != "postgresql") || !strings.HasSuffix(strings.TrimPrefix(parsed.Path, "/"), "_test") {
		return errors.New("test database required")
	}
	if development, parseErr := url.Parse(os.Getenv("DATABASE_URL")); parseErr == nil && development != nil && parsed.Path == development.Path {
		return errors.New("database isolation required")
	}
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()
	setup, cancel := context.WithTimeout(ctx, 30*time.Second)
	defer cancel()
	admin, err := pgxpool.New(setup, raw)
	if err != nil {
		return err
	}
	defer admin.Close()
	bytes := make([]byte, 12)
	if _, err = rand.Read(bytes); err != nil {
		return err
	}
	schema := "didi_e2e_" + hex.EncodeToString(bytes)
	quoted := pgx.Identifier{schema}.Sanitize()
	if _, err = admin.Exec(setup, "CREATE SCHEMA "+quoted); err != nil {
		return err
	}
	defer func() {
		cleanup, end := context.WithTimeout(context.Background(), 10*time.Second)
		defer end()
		if _, err := admin.Exec(cleanup, "DROP SCHEMA "+quoted+" CASCADE"); err != nil {
			retErr = errors.Join(retErr, errors.New("owned E2E schema cleanup failed"))
		}
	}()
	cfg, err := pgxpool.ParseConfig(raw)
	if err != nil {
		return err
	}
	cfg.ConnConfig.RuntimeParams["search_path"] = schema
	pool, err := pgxpool.NewWithConfig(setup, cfg)
	if err != nil {
		return err
	}
	defer pool.Close()
	if err = migrations.Apply(raw, schema, 0); err != nil {
		return err
	}
	if err = (identity.Repository{Pool: pool}).SeedUser(setup, "e2e-admin", "E2E 管理员", "admin", os.Getenv("E2E_PASSWORD")); err != nil {
		return err
	}
	for _, role := range []string{"editor", "viewer"} {
		if err = (identity.Repository{Pool: pool}).SeedUser(setup, "e2e-"+role, "E2E "+role, role, os.Getenv("E2E_PASSWORD")); err != nil {
			return err
		}
	}
	if _, err = bootstrap.InitializeDemo(setup, pool, "e2e-admin"); err != nil {
		return err
	}
	logger := slog.New(slog.NewJSONHandler(os.Stdout, nil))
	api, err := bootstrap.API(pool, config.Config{AppOrigin: "http://127.0.0.1:18090", SessionTTL: time.Hour}, logger)
	if err != nil {
		return err
	}
	mux := http.NewServeMux()
	mux.Handle("/api/", api)
	mux.Handle("/health/", transport.NewHandler(pool.Ping, 2*time.Second))
	mux.Handle("/", web.NewHandler(web.Assets()))
	server := &http.Server{Addr: "127.0.0.1:18090", Handler: mux, ReadHeaderTimeout: 5 * time.Second, ReadTimeout: 10 * time.Second, WriteTimeout: 10 * time.Second, IdleTimeout: 30 * time.Second}
	stopped := make(chan error, 1)
	go func() { stopped <- server.ListenAndServe() }()
	select {
	case err = <-stopped:
		if !errors.Is(err, http.ErrServerClosed) {
			return err
		}
	case <-ctx.Done():
		shutdown, end := context.WithTimeout(context.Background(), 5*time.Second)
		defer end()
		if err = server.Shutdown(shutdown); err != nil {
			if closeErr := server.Close(); closeErr != nil {
				return closeErr
			}
			return err
		}
	}
	return nil
}
