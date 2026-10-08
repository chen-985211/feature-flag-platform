package config

import (
	"fmt"
	"net"
	"net/url"
	"strconv"
	"strings"
	"time"
)

type Config struct {
	DatabaseURL      string
	HTTPAddress      string
	AppOrigin        string
	SessionTTL       time.Duration
	ReadinessTimeout time.Duration
	ShutdownTimeout  time.Duration
}

func Load(getenv func(string) string) (Config, error) {
	cfg := Config{
		DatabaseURL: strings.TrimSpace(getenv("DATABASE_URL")),
		HTTPAddress: valueOrDefault(getenv("HTTP_ADDR"), "127.0.0.1:8080"),
		AppOrigin:   valueOrDefault(getenv("APP_ORIGIN"), "http://localhost:5173"),
	}
	database, err := url.Parse(cfg.DatabaseURL)
	if err != nil || database == nil || (database.Scheme != "postgresql" && database.Scheme != "postgres") || database.Path == "" || database.Path == "/" {
		return Config{}, invalid("DATABASE_URL", "must be a PostgreSQL URL with a database name")
	}
	_, port, err := net.SplitHostPort(cfg.HTTPAddress)
	if err != nil || !validPort(port) {
		return Config{}, invalid("HTTP_ADDR", "must include a port between 1 and 65535")
	}
	origin, err := url.Parse(cfg.AppOrigin)
	if err != nil || origin == nil || (origin.Scheme != "http" && origin.Scheme != "https") || origin.Hostname() == "" || origin.User != nil || (origin.Path != "" && origin.Path != "/") || origin.RawQuery != "" || origin.ForceQuery || origin.Fragment != "" {
		return Config{}, invalid("APP_ORIGIN", "must be an HTTP origin without credentials, path, query or fragment")
	}
	if port := origin.Port(); port != "" && !validPort(port) {
		return Config{}, invalid("APP_ORIGIN", "must have a valid port")
	}
	cfg.AppOrigin = origin.Scheme + "://" + origin.Host
	if cfg.SessionTTL, err = duration(getenv, "SESSION_TTL", 12*time.Hour); err != nil {
		return Config{}, err
	}
	if cfg.ReadinessTimeout, err = duration(getenv, "READINESS_TIMEOUT", 2*time.Second); err != nil {
		return Config{}, err
	}
	if cfg.ShutdownTimeout, err = duration(getenv, "SHUTDOWN_TIMEOUT", 10*time.Second); err != nil {
		return Config{}, err
	}
	return cfg, nil
}

func valueOrDefault(value, fallback string) string {
	if value = strings.TrimSpace(value); value != "" {
		return value
	}
	return fallback
}

func validPort(raw string) bool {
	port, err := strconv.Atoi(raw)
	return err == nil && port > 0 && port <= 65535
}

func duration(getenv func(string) string, field string, fallback time.Duration) (time.Duration, error) {
	raw := strings.TrimSpace(getenv(field))
	if raw == "" {
		return fallback, nil
	}
	value, err := time.ParseDuration(raw)
	if err != nil || value <= 0 {
		return 0, invalid(field, "must be a positive duration")
	}
	return value, nil
}

// Errors identify the field, but never include a secret configuration value.
func invalid(field, reason string) error {
	return fmt.Errorf("invalid configuration: %s %s", field, reason)
}
