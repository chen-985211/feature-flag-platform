package infrastructure

import (
	"context"
	app "didi/backend/internal/contexts/flags/application"
	"didi/backend/internal/contexts/flags/domain"
	"errors"
	"github.com/jackc/pgx/v5"
	"time"
)

func (r Repository) Versions(ctx context.Context, id string, limit, offset int) (app.VersionsPage, error) {
	out := app.VersionsPage{Items: []app.VersionSummary{}}
	rows, err := r.Pool.Query(ctx, `WITH page AS (SELECT revision,schema_version,actor_id,created_at FROM flag_versions WHERE flag_id=$1 ORDER BY revision DESC LIMIT $2 OFFSET $3) SELECT (SELECT count(*) FROM flag_versions WHERE flag_id=$1),p.revision,p.schema_version,p.actor_id::text,COALESCE((SELECT a.actor_name FROM audit_entries a WHERE a.flag_id=$1 AND a.revision=p.revision ORDER BY a.created_at,a.id LIMIT 1),u.display_name),p.created_at FROM (SELECT 1) anchor LEFT JOIN page p ON true LEFT JOIN users u ON u.id=p.actor_id ORDER BY p.revision DESC`, id, limit, offset)
	if err != nil {
		return out, err
	}
	defer rows.Close()
	for rows.Next() {
		var rev *int64
		var schema *int
		var actorID, name *string
		var created *time.Time
		if err = rows.Scan(&out.Total, &rev, &schema, &actorID, &name, &created); err != nil {
			return out, err
		}
		if rev != nil {
			out.Items = append(out.Items, app.VersionSummary{Revision: *rev, SchemaVersion: *schema, ActorID: *actorID, ActorName: *name, CreatedAt: created.UTC()})
		}
	}
	return out, rows.Err()
}
func (r Repository) Version(ctx context.Context, id string, revision int64) (app.Version, error) {
	var out app.Version
	var raw []byte
	err := r.Pool.QueryRow(ctx, `SELECT v.revision,v.schema_version,v.actor_id::text,COALESCE((SELECT a.actor_name FROM audit_entries a WHERE a.flag_id=v.flag_id AND a.revision=v.revision ORDER BY a.created_at,a.id LIMIT 1),u.display_name),v.created_at,v.snapshot FROM flag_versions v JOIN users u ON u.id=v.actor_id WHERE v.flag_id=$1 AND v.revision=$2`, id, revision).Scan(&out.Revision, &out.SchemaVersion, &out.ActorID, &out.ActorName, &out.CreatedAt, &raw)
	if errors.Is(err, pgx.ErrNoRows) {
		return out, app.ErrVersionNotFound
	}
	if err != nil {
		return out, err
	}
	out.CreatedAt = out.CreatedAt.UTC()
	out.Snapshot, err = decodeSnapshot(raw)
	return out, err
}
func (s scope) Version(ctx context.Context, id string, revision int64) (domain.Snapshot, error) {
	var raw []byte
	err := s.tx.QueryRow(ctx, `SELECT snapshot FROM flag_versions WHERE flag_id=$1 AND revision=$2`, id, revision).Scan(&raw)
	if errors.Is(err, pgx.ErrNoRows) {
		return domain.Snapshot{}, app.ErrVersionNotFound
	}
	if err != nil {
		return domain.Snapshot{}, err
	}
	return decodeSnapshot(raw)
}
