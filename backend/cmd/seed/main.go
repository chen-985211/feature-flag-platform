package main

import (
	"context"
	identity "didi/backend/internal/contexts/identity/infrastructure"
	"didi/backend/internal/platform/config"
	"errors"
	"fmt"
	"github.com/jackc/pgx/v5/pgxpool"
	"os"
	"time"
)

func main() {
	if err := run(); err != nil {
		fmt.Fprintln(os.Stderr, "SEED_FAILED: check database, migrations and SEED_*_PASSWORD (8–72 bytes)")
		os.Exit(1)
	}
}
func run() error {
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
	return nil
}
