package main

import (
	"context"
	flags "didi/backend/internal/contexts/flags/application"
	identity "didi/backend/internal/contexts/identity/infrastructure"
	"didi/backend/internal/platform/bootstrap"
	"didi/backend/internal/platform/config"
	"errors"
	"fmt"
	"github.com/jackc/pgx/v5/pgxpool"
	"os"
	"time"
)

func main() {
	if err := run(); err != nil {
		switch {
		case errors.Is(err, flags.ErrForbidden):
			fmt.Fprintln(os.Stderr, "SEED_FORBIDDEN: the persisted admin account must retain permission to write all environments")
		case errors.Is(err, flags.ErrKeyConflict):
			fmt.Fprintln(os.Stderr, "SEED_KEY_CONFLICT: a demo key is owned by another flag; no demo configurations were committed")
		default:
			fmt.Fprintln(os.Stderr, "SEED_FAILED: use users or demo; check database, migrations and SEED_*_PASSWORD (8–72 bytes)")
		}
		os.Exit(1)
	}
}
func run() error {
	mode := "users"
	if len(os.Args) == 2 {
		mode = os.Args[1]
	}
	if len(os.Args) > 2 || mode != "users" && mode != "demo" {
		return errors.New("invalid seed mode")
	}
	cfg, err := config.Load(os.Getenv)
	if err != nil {
		return err
	}
	for _, role := range []string{"ADMIN", "EDITOR", "VIEWER"} {
		password := os.Getenv("SEED_" + role + "_PASSWORD")
		if len(password) < 8 || len(password) > 72 {
			return errors.New("seed password required")
		}
	}
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()
	pool, err := pgxpool.New(ctx, cfg.DatabaseURL)
	if err != nil {
		return err
	}
	defer pool.Close()
	repo := identity.Repository{Pool: pool}
	for _, u := range []struct{ role, name, env string }{{"admin", "管理员", "SEED_ADMIN_PASSWORD"}, {"editor", "编辑者", "SEED_EDITOR_PASSWORD"}, {"viewer", "查看者", "SEED_VIEWER_PASSWORD"}} {
		if err = repo.SeedUser(ctx, u.role, u.name, u.role, os.Getenv(u.env)); err != nil {
			return err
		}
	}
	fmt.Println("PASS: accounts initialized; existing credentials and roles preserved.")
	if mode == "demo" {
		result, err := bootstrap.InitializeDemo(ctx, pool, "admin")
		if err != nil {
			return err
		}
		fmt.Printf("PASS: demo flags created=%d preserved=%d; existing configurations and history preserved.\n", result.Created, result.Preserved)
	}
	return nil
}
