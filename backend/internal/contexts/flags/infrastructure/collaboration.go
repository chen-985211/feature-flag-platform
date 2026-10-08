package infrastructure

import (
	"context"
	audit "didi/backend/internal/contexts/audit/public"
	app "didi/backend/internal/contexts/flags/application"
	identity "didi/backend/internal/contexts/identity/public"
	"encoding/json"
)

func Authorize(actor app.Actor, environment string) bool {
	return identity.CanWrite(actor.Role, environment)
}

type AuditAdapter struct {
	Service audit.Service
	NewID   func() string
}

func (a AuditAdapter) Append(ctx context.Context, c app.Change) error {
	// Explicit configuration fields, never raw request bodies or evaluation attributes.
	var before any
	if c.Before != nil {
		before = stored(*c.Before)
	}
	changes, err := json.Marshal(struct {
		RestoredRevision int64 `json:"restored_revision,omitempty"`
		Before           any   `json:"before"`
		After            any   `json:"after"`
	}{c.RestoredRevision, before, stored(c.After)})
	if err != nil {
		return err
	}
	return a.Service.Append(ctx, audit.Entry{ID: a.NewID(), FlagID: c.After.ID, Environment: c.After.Environment, Key: c.After.Key, Revision: c.After.Revision, ActorID: c.Actor.ID, ActorName: c.Actor.Name, Action: c.Action, Changes: changes, RequestID: c.RequestID, CreatedAt: c.After.UpdatedAt})
}
