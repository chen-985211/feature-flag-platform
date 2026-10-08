package infrastructure

import (
	"context"
	app "didi/backend/internal/contexts/audit/application"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"time"
)

type Appender struct{ Tx pgx.Tx }

func (r Appender) Insert(ctx context.Context, e app.Entry) error {
	_, err := r.Tx.Exec(ctx, `INSERT INTO audit_entries(id,flag_id,revision,actor_id,actor_name,action,changes,request_id,created_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)`, e.ID, e.FlagID, e.Revision, e.ActorID, e.ActorName, e.Action, []byte(e.Changes), e.RequestID, e.CreatedAt)
	return err
}

type Reader struct{ Pool *pgxpool.Pool }

func (r Reader) List(ctx context.Context, id string, limit, offset int) ([]app.Entry, int, error) {
	entries := []app.Entry{}
	total := 0
	rows, err := r.Pool.Query(ctx, `WITH matched AS (SELECT a.*,v.snapshot->>'Environment' AS environment,v.snapshot->>'Key' AS key FROM audit_entries a JOIN flag_versions v ON v.flag_id=a.flag_id AND v.revision=a.revision WHERE a.flag_id=$1), page AS (SELECT * FROM matched ORDER BY created_at DESC,id LIMIT $2 OFFSET $3) SELECT (SELECT count(*) FROM matched),p.id::text,p.flag_id::text,p.revision,p.actor_id::text,p.actor_name,p.action,p.changes,p.request_id,p.created_at,p.environment,p.key FROM (SELECT 1) anchor LEFT JOIN page p ON true ORDER BY p.created_at DESC,p.id`, id, limit, offset)
	if err != nil {
		return entries, total, err
	}
	defer rows.Close()
	for rows.Next() {
		var e app.Entry
		var entryID, flagID, actorID, name, action, request, environment, key *string
		var revision *int64
		var created *time.Time
		if err = rows.Scan(&total, &entryID, &flagID, &revision, &actorID, &name, &action, &e.Changes, &request, &created, &environment, &key); err != nil {
			return entries, total, err
		}
		if entryID != nil {
			e.ID = *entryID
			e.FlagID = *flagID
			e.Revision = *revision
			e.ActorID = *actorID
			e.ActorName = *name
			e.Action = *action
			e.RequestID = *request
			e.CreatedAt = *created
			e.Environment = *environment
			e.Key = *key
			entries = append(entries, e)
		}
	}
	return entries, total, rows.Err()
}
