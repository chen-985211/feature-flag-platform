package foundation_test

import (
	"context"
	"errors"
	"github.com/jackc/pgx/v5"
	"testing"
	"time"

	"didi/backend/migrations"
	"didi/backend/tests/support"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"
)

const actor = "10000000-0000-4000-8000-000000000001"
const flag = "20000000-0000-4000-8000-000000000001"
const seed = "30000000-0000-4000-8000-000000000001"
const snapshot = `{"schemaVersion":1,"name":"Checkout","key":"checkout","enabled":true,"default":false,"seed":"30000000-0000-4000-8000-000000000001","rules":[]}`

func exec(t *testing.T, pool *pgxpool.Pool, query string, args ...any) {
	t.Helper()
	if _, err := pool.Exec(context.Background(), query, args...); err != nil {
		t.Fatal(err)
	}
}
func transaction(t *testing.T, pool *pgxpool.Pool) (pgx.Tx, error) {
	t.Helper()
	tx, err := pool.Begin(context.Background())
	if err == nil {
		t.Cleanup(func() {
			ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
			defer cancel()
			if err := tx.Rollback(ctx); err != nil && !errors.Is(err, pgx.ErrTxClosed) {
				t.Errorf("rollback cleanup: %v", err)
			}
		})
	}
	return tx, err
}
func fixture(t *testing.T, pool *pgxpool.Pool) {
	t.Helper()
	exec(t, pool, `INSERT INTO users(id, username, password_hash, display_name, role) VALUES ($1,'reviewer','test-hash','Reviewer','admin')`, actor)
	tx, err := transaction(t, pool)
	if err != nil {
		t.Fatal(err)
	}
	if _, err = tx.Exec(context.Background(), `INSERT INTO flags(id,name,key,environment,seed,revision) VALUES ($1,'Checkout','checkout','development',$2,1)`, flag, seed); err == nil {
		_, err = tx.Exec(context.Background(), `INSERT INTO flag_versions(flag_id,revision,snapshot,actor_id) VALUES ($1,1,$2,$3)`, flag, snapshot, actor)
	}
	if err != nil {
		if rollbackErr := tx.Rollback(context.Background()); rollbackErr != nil {
			t.Fatal(rollbackErr)
		}
		t.Fatal(err)
	}
	if err := tx.Commit(context.Background()); err != nil {
		t.Fatal(err)
	}
}
func code(t *testing.T, err error, expected string) {
	t.Helper()
	var pgError *pgconn.PgError
	if !errors.As(err, &pgError) || pgError.Code != expected {
		t.Fatalf("expected SQLSTATE %s, got %v", expected, err)
	}
}
func count(t *testing.T, pool *pgxpool.Pool, query string) int {
	t.Helper()
	var value int
	if err := pool.QueryRow(context.Background(), query).Scan(&value); err != nil {
		t.Fatal(err)
	}
	return value
}

func TestEmptySchemaMigrationRepeatAndDown(t *testing.T) {
	pool, raw, schema := support.Database(t)
	if actual := count(t, pool, `SELECT count(*) FROM information_schema.tables WHERE table_schema=current_schema() AND table_name IN ('users','sessions','flags','rules','flag_versions','audit_entries')`); actual != 6 {
		t.Fatalf("expected 6 foundation tables, got %d", actual)
	}
	if err := migrations.Apply(raw, schema, 0); err != nil {
		t.Fatal(err)
	}
	if err := migrations.Apply(raw, schema, -1); err != nil {
		t.Fatal(err)
	}
	if actual := count(t, pool, `SELECT count(*) FROM information_schema.tables WHERE table_schema=current_schema() AND table_name='flags'`); actual != 0 {
		t.Fatal("down did not remove foundation tables")
	}
	if err := migrations.Apply(raw, schema, 0); err != nil {
		t.Fatal(err)
	}
	if count(t, pool, "SELECT count(*) FROM flags") != 0 {
		t.Fatal("migration must not seed business data")
	}
}
func TestEnvironmentKeyUniqueness(t *testing.T) {
	pool, _, _ := support.Database(t)
	fixture(t, pool)
	_, err := pool.Exec(context.Background(), `INSERT INTO flags(id,name,key,environment,seed,revision) VALUES ('20000000-0000-4000-8000-000000000002','Other','checkout','development',$1,1)`, seed)
	code(t, err, "23505")
	tx, err := transaction(t, pool)
	if err != nil {
		t.Fatal(err)
	}
	_, err = tx.Exec(context.Background(), `INSERT INTO flags(id,name,key,environment,seed,revision) VALUES ('20000000-0000-4000-8000-000000000002','Other','checkout','staging',$1,1)`, seed)
	if err != nil {
		t.Fatal(err)
	}
	_, err = tx.Exec(context.Background(), `INSERT INTO flag_versions(flag_id,revision,snapshot,actor_id) VALUES ('20000000-0000-4000-8000-000000000002',1,$1,$2)`, snapshot, actor)
	if err != nil {
		t.Fatal(err)
	}
	if err := tx.Commit(context.Background()); err != nil {
		t.Fatal(err)
	}
	if count(t, pool, "SELECT count(*) FROM flags") != 2 {
		t.Fatal("different environments should allow same key")
	}
}
func TestPriorityConstraintAllowsAtomicReorder(t *testing.T) {
	pool, _, _ := support.Database(t)
	fixture(t, pool)
	exec(t, pool, `INSERT INTO rules(id,flag_id,priority,kind,percentage_bp,result) VALUES ('40000000-0000-4000-8000-000000000001',$1,1,'percentage',5000,true),('40000000-0000-4000-8000-000000000002',$1,2,'percentage',2500,false)`, flag)
	_, err := pool.Exec(context.Background(), `INSERT INTO rules(id,flag_id,priority,kind,percentage_bp,result) VALUES ('40000000-0000-4000-8000-000000000003',$1,1,'percentage',100,true)`, flag)
	code(t, err, "23505")
	tx, err := transaction(t, pool)
	if err != nil {
		t.Fatal(err)
	}
	if _, err := tx.Exec(context.Background(), `UPDATE rules SET priority=3-priority WHERE flag_id=$1`, flag); err != nil {
		t.Fatal(err)
	}
	if err := tx.Commit(context.Background()); err != nil {
		t.Fatal(err)
	}
	var priority int
	if err := pool.QueryRow(context.Background(), `SELECT priority FROM rules WHERE id='40000000-0000-4000-8000-000000000001'`).Scan(&priority); err != nil || priority != 2 {
		t.Fatalf("reorder failed: %d %v", priority, err)
	}
}
func TestInvalidRuleShapesRejected(t *testing.T) {
	pool, _, _ := support.Database(t)
	fixture(t, pool)
	for _, query := range []string{
		`INSERT INTO rules(id,flag_id,priority,kind,percentage_bp,result) VALUES ('40000000-0000-4000-8000-000000000003',$1,1,'percentage',10001,true)`,
		`INSERT INTO rules(id,flag_id,priority,kind,attribute,operator,expected,result) VALUES ('40000000-0000-4000-8000-000000000003',$1,0,'attribute','country','equals','"CN"',true)`,
		`INSERT INTO rules(id,flag_id,priority,kind,attribute,operator,expected,result) VALUES ('40000000-0000-4000-8000-000000000003',$1,1,'attribute','country','in','[]',true)`,
		`INSERT INTO rules(id,flag_id,priority,kind,attribute,operator,expected,result) VALUES ('40000000-0000-4000-8000-000000000003',$1,1,'attribute','country','in','["CN",1]',true)`,
	} {
		_, err := pool.Exec(context.Background(), query, flag)
		code(t, err, "23514")
	}
	exec(t, pool, `INSERT INTO rules(id,flag_id,priority,kind,attribute,operator,expected,result) VALUES ('40000000-0000-4000-8000-000000000003',$1,1,'attribute','country','in','["CN","US"]',true)`, flag)
}
func TestCurrentRevisionRequiresCommittedSnapshot(t *testing.T) {
	pool, _, _ := support.Database(t)
	fixture(t, pool)
	_, err := pool.Exec(context.Background(), `UPDATE flags SET revision=2 WHERE id=$1`, flag)
	code(t, err, "23503")
	if count(t, pool, "SELECT revision FROM flags") != 1 {
		t.Fatal("failed revision update persisted")
	}
}
func TestAuditFailureRollsBackConfigurationAndVersion(t *testing.T) {
	pool, _, _ := support.Database(t)
	fixture(t, pool)
	tx, err := transaction(t, pool)
	if err != nil {
		t.Fatal(err)
	}
	if _, err := tx.Exec(context.Background(), `UPDATE flags SET name='Changed',revision=2 WHERE id=$1`, flag); err != nil {
		t.Fatal(err)
	}
	if _, err := tx.Exec(context.Background(), `INSERT INTO flag_versions(flag_id,revision,snapshot,actor_id) VALUES ($1,2,$2,$3)`, flag, snapshot, actor); err != nil {
		t.Fatal(err)
	}
	_, err = tx.Exec(context.Background(), `INSERT INTO audit_entries(id,flag_id,revision,actor_id,actor_name,action,changes,request_id) VALUES ('50000000-0000-4000-8000-000000000001',$1,2,$2,'Reviewer','','{}','request-1')`, flag, actor)
	code(t, err, "23514")
	if err := tx.Commit(context.Background()); err == nil {
		t.Fatal("aborted transaction unexpectedly committed")
	}
	if count(t, pool, "SELECT revision FROM flags") != 1 || count(t, pool, "SELECT count(*) FROM flag_versions") != 1 || count(t, pool, "SELECT count(*) FROM audit_entries") != 0 {
		t.Fatal("failed transaction left partial configuration/version/audit")
	}
}
