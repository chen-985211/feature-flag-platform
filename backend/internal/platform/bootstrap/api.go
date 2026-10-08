package bootstrap

import (
	"context"
	auditApp "didi/backend/internal/contexts/audit/application"
	auditInfra "didi/backend/internal/contexts/audit/infrastructure"
	auditPublic "didi/backend/internal/contexts/audit/public"
	flagApp "didi/backend/internal/contexts/flags/application"
	flagInfra "didi/backend/internal/contexts/flags/infrastructure"
	identityApp "didi/backend/internal/contexts/identity/application"
	identityInfra "didi/backend/internal/contexts/identity/infrastructure"
	"didi/backend/internal/platform/config"
	transport "didi/backend/internal/platform/http"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"log/slog"
	"net/http"
	"time"
)

func API(pool *pgxpool.Pool, cfg config.Config, logger *slog.Logger) (http.Handler, error) {
	passwords := identityInfra.Passwords{}
	tokens := identityInfra.Tokens{}
	dummy, err := passwords.Hash(tokens.New())
	if err != nil {
		return nil, err
	}
	identity := identityApp.Service{Store: identityInfra.Repository{Pool: pool}, Passwords: passwords, Tokens: tokens, Now: time.Now, TTL: cfg.SessionTTL, DummyHash: dummy}
	auth := identityInfra.HTTP{Service: identity, Origin: cfg.AppOrigin, Limiter: &identityInfra.LoginLimiter{Now: time.Now}}
	store := flagInfra.Repository{Pool: pool, AuditFactory: func(tx pgx.Tx) flagApp.AuditPort {
		return flagInfra.AuditAdapter{Service: auditPublic.Service{UseCases: auditApp.Service{Appender: auditInfra.Appender{Tx: tx}}}, NewID: identityInfra.NewID}
	}}
	flags := flagApp.Service{Store: store, Authorize: flagInfra.Authorize, NewID: identityInfra.NewID, Now: func() time.Time { return time.Now().UTC() }}
	business := http.NewServeMux()
	flagInfra.HTTP{Service: flags, Actor: func(r *http.Request) flagApp.Actor {
		u := identityInfra.SessionFrom(r).User
		return flagApp.Actor{ID: u.ID, Name: u.Name, Role: u.Role}
	}, Mutation: auth.Mutation}.Register(business)
	auditInfra.HTTP{Service: auditApp.Service{Reader: auditInfra.Reader{Pool: pool}}, FlagExists: func(ctx context.Context, id string) error { _, err := store.Get(ctx, id); return err }}.Register(business)
	mux := http.NewServeMux()
	auth.Register(mux)
	mux.Handle("/", auth.Auth(business))
	return transport.Middleware(logger, mux), nil
}
