package infrastructure

import (
	"context"
	app "didi/backend/internal/contexts/flags/application"
	"didi/backend/internal/contexts/flags/domain"
	"errors"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"
	"strings"
)

type Repository struct {
	Pool         *pgxpool.Pool
	AuditFactory func(pgx.Tx) app.AuditPort
}
type scope struct {
	tx    pgx.Tx
	audit app.AuditPort
}

func (r Repository) Within(ctx context.Context, fn func(app.Scope) error) (retErr error) {
	tx, err := r.Pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer func() {
		if err := tx.Rollback(context.WithoutCancel(ctx)); err != nil && !errors.Is(err, pgx.ErrTxClosed) {
			retErr = errors.Join(retErr, err)
		}
	}()
	if err = fn(scope{tx: tx, audit: r.AuditFactory(tx)}); err != nil {
		return classify(err)
	}
	return classify(tx.Commit(ctx))
}
func classify(err error) error {
	var pg *pgconn.PgError
	if errors.As(err, &pg) && pg.Code == "23505" {
		switch pg.ConstraintName {
		case "flags_environment_key_unique":
			return app.ErrKeyConflict
		case "rules_priority_unique":
			return domain.ErrPriority
		}
	}
	return err
}

const currentQuery = `SELECT v.snapshot FROM flags f JOIN flag_versions v ON v.flag_id=f.id AND v.revision=f.revision `

func decode(row pgx.Row) (domain.Snapshot, error) {
	var raw []byte
	if err := row.Scan(&raw); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return domain.Snapshot{}, app.ErrNotFound
		}
		return domain.Snapshot{}, err
	}
	return decodeSnapshot(raw)
}
func (r Repository) Get(ctx context.Context, id string) (domain.Snapshot, error) {
	return decode(r.Pool.QueryRow(ctx, currentQuery+`WHERE f.id=$1`, id))
}
func (r Repository) ByKey(ctx context.Context, environment, key string) (domain.Snapshot, error) {
	return decode(r.Pool.QueryRow(ctx, currentQuery+`WHERE f.environment=$1 AND f.key=$2`, environment, key))
}
func (r Repository) List(ctx context.Context, f app.Filter) (app.Page, error) {
	out := app.Page{Items: []domain.Snapshot{}}
	escaped := strings.NewReplacer(`\`, `\\`, `%`, `\%`, `_`, `\_`).Replace(f.Query)
	args := []any{f.Environment, "%" + escaped + "%", f.Enabled, f.Limit, f.Offset}
	// Window count and rows share one statement/snapshot, including empty pages.
	rows, err := r.Pool.Query(ctx, `WITH matched AS (SELECT f.id,f.updated_at,v.snapshot FROM flags f JOIN flag_versions v ON v.flag_id=f.id AND v.revision=f.revision WHERE f.environment=$1 AND (f.name ILIKE $2 OR f.key ILIKE $2) AND ($3::boolean IS NULL OR f.enabled=$3)), page AS (SELECT snapshot,id,updated_at FROM matched ORDER BY updated_at DESC,id LIMIT $4 OFFSET $5) SELECT (SELECT count(*) FROM matched),page.snapshot FROM (SELECT 1) anchor LEFT JOIN page ON true ORDER BY page.updated_at DESC,page.id`, args...)
	if err != nil {
		return out, err
	}
	defer rows.Close()
	for rows.Next() {
		var raw []byte
		if err = rows.Scan(&out.Total, &raw); err != nil {
			return out, err
		}
		if raw != nil {
			s, decodeErr := decodeSnapshot(raw)
			if decodeErr != nil {
				return out, decodeErr
			}
			out.Items = append(out.Items, s)
		}
	}
	return out, rows.Err()
}
func (s scope) Load(ctx context.Context, id string) (domain.Snapshot, error) {
	// Lock the aggregate before reading its immutable version. A joined locking
	// query can lose its old-version match after waiting for another writer.
	var revision int64
	err := s.tx.QueryRow(ctx, `SELECT revision FROM flags WHERE id=$1 FOR UPDATE`, id).Scan(&revision)
	if errors.Is(err, pgx.ErrNoRows) {
		return domain.Snapshot{}, app.ErrNotFound
	}
	if err != nil {
		return domain.Snapshot{}, err
	}
	return decode(s.tx.QueryRow(ctx, `SELECT snapshot FROM flag_versions WHERE flag_id=$1 AND revision=$2`, id, revision))
}
func (s scope) Audit() app.AuditPort { return s.audit }

const insertHeader = `INSERT INTO flags(id,name,key,environment,enabled,default_value,seed,revision,created_at,updated_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) `

func headerValues(f domain.Snapshot) []any {
	return []any{f.ID, f.Name, f.Key, f.Environment, f.Enabled, f.DefaultValue, f.Seed, f.Revision, f.CreatedAt, f.UpdatedAt}
}
func (s scope) Create(ctx context.Context, f domain.Snapshot, actor app.Actor) (bool, error) {
	// The unique index waits for a concurrent creator. Only the inserting
	// transaction writes rules/version; an existing ID is never updated.
	tag, err := s.tx.Exec(ctx, insertHeader+`ON CONFLICT(id) DO NOTHING`, headerValues(f)...)
	if err != nil || tag.RowsAffected() == 0 {
		return false, err
	}
	if err := s.saveContents(ctx, f, actor); err != nil {
		return false, err
	}
	return true, nil
}
func (s scope) Save(ctx context.Context, f domain.Snapshot, actor app.Actor) error {
	_, err := s.tx.Exec(ctx, insertHeader+`ON CONFLICT(id) DO UPDATE SET name=EXCLUDED.name,key=EXCLUDED.key,enabled=EXCLUDED.enabled,default_value=EXCLUDED.default_value,seed=EXCLUDED.seed,revision=EXCLUDED.revision,updated_at=EXCLUDED.updated_at`, headerValues(f)...)
	if err != nil {
		return err
	}
	return s.saveContents(ctx, f, actor)
}
func (s scope) saveContents(ctx context.Context, f domain.Snapshot, actor app.Actor) error {
	raw, err := encodeSnapshot(f)
	if err != nil {
		return err
	}
	if _, err = s.tx.Exec(ctx, `DELETE FROM rules WHERE flag_id=$1`, f.ID); err != nil {
		return err
	}
	for _, r := range f.Rules {
		var attribute, operator, expected any
		if r.Kind == "attribute" {
			attribute = r.Attribute
			operator = r.Operator
			expected = []byte(r.Expected)
		}
		if _, err = s.tx.Exec(ctx, `INSERT INTO rules(id,flag_id,priority,kind,attribute,operator,expected,percentage_bp,result) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)`, r.ID, f.ID, r.Priority, r.Kind, attribute, operator, expected, r.PercentageBP, r.Result); err != nil {
			return err
		}
	}
	_, err = s.tx.Exec(ctx, `INSERT INTO flag_versions(flag_id,revision,schema_version,snapshot,actor_id,created_at) VALUES($1,$2,$3,$4,$5,$6)`, f.ID, f.Revision, f.SchemaVersion, raw, actor.ID, f.UpdatedAt)
	return err
}
