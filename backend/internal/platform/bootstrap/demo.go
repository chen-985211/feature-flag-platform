package bootstrap

import (
	"context"
	auditApp "didi/backend/internal/contexts/audit/application"
	auditInfra "didi/backend/internal/contexts/audit/infrastructure"
	auditPublic "didi/backend/internal/contexts/audit/public"
	flagApp "didi/backend/internal/contexts/flags/application"
	flagInfra "didi/backend/internal/contexts/flags/infrastructure"
	identity "didi/backend/internal/contexts/identity/infrastructure"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"time"
)

func flagsService(pool *pgxpool.Pool) flagApp.Service {
	store := flagInfra.Repository{Pool: pool, AuditFactory: func(tx pgx.Tx) flagApp.AuditPort {
		return flagInfra.AuditAdapter{Service: auditPublic.Service{UseCases: auditApp.Service{Appender: auditInfra.Appender{Tx: tx}}}, NewID: identity.NewID}
	}}
	return flagApp.Service{Store: store, Authorize: flagInfra.Authorize, NewID: identity.NewID, Now: func() time.Time { return time.Now().UTC() }}
}

// InitializeDemo uses the persisted user's current role and name as the Actor.
func InitializeDemo(ctx context.Context, pool *pgxpool.Pool, username string) (flagApp.DemoResult, error) {
	user, err := (identity.Repository{Pool: pool}).User(ctx, username)
	if err != nil {
		return flagApp.DemoResult{}, err
	}
	return flagsService(pool).InitializeDemo(ctx, flagApp.Actor{ID: user.ID, Name: user.Name, Role: user.Role}, identity.NewID())
}
