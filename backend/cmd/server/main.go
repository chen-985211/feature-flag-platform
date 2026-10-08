package main

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"didi/backend/internal/platform/config"
	httptransport "didi/backend/internal/platform/http"
	"didi/backend/internal/platform/web"
	"github.com/jackc/pgx/v5/pgxpool"
)

func main() {
	logger := slog.New(slog.NewJSONHandler(os.Stdout, nil))
	if err := run(logger); err != nil {
		logger.Error("API stopped", "error", err.Error())
		os.Exit(1)
	}
}

func run(logger *slog.Logger) error {
	cfg, err := config.Load(os.Getenv)
	if err != nil {
		return err
	}
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()
	pool, err := pgxpool.New(ctx, cfg.DatabaseURL)
	if err != nil {
		// A connection parser error can contain the DSN, so do not wrap it.
		return errors.New("DATABASE_CONFIG_REJECTED: invalid database connection settings")
	}
	defer pool.Close()
	mux := http.NewServeMux()
	mux.Handle("/health/", httptransport.NewHandler(pool.Ping, cfg.ReadinessTimeout))
	mux.Handle("/", web.NewHandler(web.Assets()))
	server := &http.Server{
		Addr: cfg.HTTPAddress, Handler: mux,
		ReadHeaderTimeout: 5 * time.Second, ReadTimeout: 10 * time.Second,
		WriteTimeout: 10 * time.Second, IdleTimeout: 60 * time.Second, MaxHeaderBytes: 16 << 10,
	}
	stopped := make(chan error, 1)
	go func() { stopped <- server.ListenAndServe() }()
	logger.Info("API starting", "address", cfg.HTTPAddress)
	select {
	case err := <-stopped:
		if !errors.Is(err, http.ErrServerClosed) {
			return fmt.Errorf("HTTP_LISTEN_FAILED: %w", err)
		}
	case <-ctx.Done():
		shutdown, cancel := context.WithTimeout(context.Background(), cfg.ShutdownTimeout)
		defer cancel()
		if err := server.Shutdown(shutdown); err != nil {
			if closeErr := server.Close(); closeErr != nil {
				return errors.New("HTTP_CLOSE_FAILED: server could not close after graceful shutdown deadline")
			}
			return errors.New("HTTP_SHUTDOWN_TIMEOUT: server closed after graceful shutdown deadline")
		}
	}
	return nil
}
