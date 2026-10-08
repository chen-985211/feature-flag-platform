package config_test

import (
	"strings"
	"testing"
	"time"

	"didi/backend/internal/platform/config"
)

func TestValidConfigurationDefaults(t *testing.T) {
	env := map[string]string{"DATABASE_URL": "postgresql:///didi_development?host=/tmp"}
	got, err := config.Load(func(key string) string { return env[key] })
	if err != nil {
		t.Fatalf("valid database configuration rejected: %v", err)
	}
	if got.DatabaseURL != env["DATABASE_URL"] || got.HTTPAddress != "127.0.0.1:8080" || got.AppOrigin != "http://localhost:5173" {
		t.Fatalf("unexpected development defaults: %#v", got)
	}
	if got.SessionTTL != 12*time.Hour || got.ReadinessTimeout != 2*time.Second || got.ShutdownTimeout != 10*time.Second {
		t.Fatalf("unexpected timeout defaults: %#v", got)
	}
}

func TestExplicitConfiguration(t *testing.T) {
	env := map[string]string{
		"DATABASE_URL": "postgresql://localhost/didi_development", "HTTP_ADDR": "0.0.0.0:9000",
		"APP_ORIGIN": "https://example.test/", "SESSION_TTL": "8h", "READINESS_TIMEOUT": "500ms", "SHUTDOWN_TIMEOUT": "5s",
	}
	got, err := config.Load(func(key string) string { return env[key] })
	if err != nil {
		t.Fatal(err)
	}
	if got.HTTPAddress != "0.0.0.0:9000" || got.AppOrigin != "https://example.test" || got.SessionTTL != 8*time.Hour || got.ReadinessTimeout != 500*time.Millisecond || got.ShutdownTimeout != 5*time.Second {
		t.Fatalf("explicit settings not respected: %#v", got)
	}
}

func TestInvalidConfigurationDoesNotExposeInput(t *testing.T) {
	cases := []struct{ name, field, value string }{
		{"missing database", "DATABASE_URL", ""},
		{"wrong database scheme", "DATABASE_URL", "https://user:secret-value@database.test/app"},
		{"missing database name", "DATABASE_URL", "postgresql://user:secret-value@database.test/"},
		{"malformed database", "DATABASE_URL", "postgresql://user:secret-value@database.test/%ZZ"},
		{"missing port", "HTTP_ADDR", "localhost"},
		{"zero port", "HTTP_ADDR", "localhost:0"},
		{"large port", "HTTP_ADDR", "localhost:65536"},
		{"non-numeric port", "HTTP_ADDR", "localhost:secret-value"},
		{"origin credentials", "APP_ORIGIN", "https://user:secret-value@example.test"},
		{"origin path", "APP_ORIGIN", "https://example.test/path"},
		{"origin query", "APP_ORIGIN", "https://example.test?secret-value=true"},
		{"origin fragment", "APP_ORIGIN", "https://example.test#secret-value"},
		{"origin scheme", "APP_ORIGIN", "file:///secret-value"},
		{"zero session", "SESSION_TTL", "0s"},
		{"negative session", "SESSION_TTL", "-1h"},
		{"invalid session", "SESSION_TTL", "secret-value"},
		{"zero readiness", "READINESS_TIMEOUT", "0s"},
		{"negative shutdown", "SHUTDOWN_TIMEOUT", "-1s"},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			env := map[string]string{"DATABASE_URL": "postgresql://localhost/didi_development"}
			env[tc.field] = tc.value
			_, err := config.Load(func(key string) string { return env[key] })
			if err == nil {
				t.Fatal("invalid input accepted")
			}
			if !strings.Contains(err.Error(), tc.field) || strings.Contains(err.Error(), "secret-value") {
				t.Fatalf("error must identify field without exposing its value: %v", err)
			}
		})
	}
}
