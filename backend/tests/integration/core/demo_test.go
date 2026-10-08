package core_test

import (
	app "didi/backend/internal/contexts/flags/application"
	repo "didi/backend/internal/contexts/flags/infrastructure"
	identity "didi/backend/internal/contexts/identity/infrastructure"
	"didi/backend/tests/support"
	"encoding/json"
	"errors"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"reflect"
	"sync"
	"testing"
	"time"
)

func demoDatabase(t *testing.T) (*pgxpool.Pool, app.Service, app.Actor) {
	t.Helper()
	pool, _, _ := support.Database(t)
	if _, err := pool.Exec(t.Context(), `INSERT INTO users(id,username,password_hash,display_name,role) VALUES($1,'admin','unused','Seed Admin','admin')`, actorID); err != nil {
		t.Fatal(err)
	}
	r := repo.Repository{Pool: pool, AuditFactory: func(tx pgx.Tx) app.AuditPort { return auditSQL{tx, new(bool)} }}
	return pool, app.Service{Store: r, Authorize: repo.Authorize, NewID: identity.NewID, Now: func() time.Time { return time.Now().UTC() }}, app.Actor{ID: actorID, Name: "Seed Admin", Role: "admin"}
}
func demoCounts(t *testing.T, pool *pgxpool.Pool, wantFlags, wantVersions, wantAudit int) {
	t.Helper()
	var flags, versions, audits int
	if err := pool.QueryRow(t.Context(), `SELECT (SELECT count(*) FROM flags),(SELECT count(*) FROM flag_versions),(SELECT count(*) FROM audit_entries)`).Scan(&flags, &versions, &audits); err != nil || flags != wantFlags || versions != wantVersions || audits != wantAudit {
		t.Fatalf("counts %d/%d/%d: %v", flags, versions, audits, err)
	}
}
func TestDemoInitializationPreservesModifiedIdentityAndHistory(t *testing.T) {
	pool, service, actor := demoDatabase(t)
	result, err := service.InitializeDemo(t.Context(), actor, "demo")
	if err != nil || result.Created != 5 {
		t.Fatalf("creation %+v %v", result, err)
	}
	demoCounts(t, pool, 5, 5, 5)
	current, err := service.Store.ByKey(t.Context(), "development", "demo-checkout")
	if err != nil || len(current.Rules) != 3 || current.Revision != 1 {
		t.Fatalf("incomplete snapshot %+v %v", current, err)
	}
	for _, attrs := range []string{`{"country":"CN"}`, `{"user_id":"alice"}`} {
		if _, err := service.Evaluate(t.Context(), "development", "demo-checkout", json.RawMessage(attrs)); err != nil {
			t.Fatal(err)
		}
	}
	current, err = service.Execute(t.Context(), actor, "edit", app.Command{Action: "flag_edited", ID: current.ID, ExpectedRevision: 1, Name: "User name", Key: "user-checkout", DefaultValue: true})
	if err != nil {
		t.Fatal(err)
	}
	current, err = service.Execute(t.Context(), actor, "delete", app.Command{Action: "rule_deleted", ID: current.ID, RuleID: current.Rules[0].ID, ExpectedRevision: 2})
	if err != nil {
		t.Fatal(err)
	}
	if _, err := service.Execute(t.Context(), actor, "new owner", app.Command{Action: "flag_created", Name: "Owns original demo key", Key: "demo-checkout", Environment: "development"}); err != nil {
		t.Fatal(err)
	}
	result, err = service.InitializeDemo(t.Context(), actor, "repeat")
	after, readErr := service.Store.Get(t.Context(), current.ID)
	if err != nil || readErr != nil || result.Created != 0 || result.Preserved != 5 || !reflect.DeepEqual(current, after) {
		t.Fatalf("repeat overwrote changed aggregate %+v %v %v", result, err, readErr)
	}
	demoCounts(t, pool, 6, 8, 8)
}
func TestDemoConcurrentCreationAndAtomicFailures(t *testing.T) {
	t.Run("concurrent", func(t *testing.T) {
		pool, service, actor := demoDatabase(t)
		gate := make(chan struct{})
		outcomes := make(chan app.DemoResult, 2)
		errorsOut := make(chan error, 2)
		var wg sync.WaitGroup
		for range 2 {
			wg.Go(func() {
				<-gate
				result, err := service.InitializeDemo(t.Context(), actor, "concurrent")
				outcomes <- result
				errorsOut <- err
			})
		}
		close(gate)
		wg.Wait()
		close(outcomes)
		close(errorsOut)
		for err := range errorsOut {
			if err != nil {
				t.Fatal(err)
			}
		}
		created, preserved := 0, 0
		for result := range outcomes {
			created += result.Created
			preserved += result.Preserved
		}
		if created != 5 || preserved != 5 {
			t.Fatalf("duplicate initialization %d/%d", created, preserved)
		}
		demoCounts(t, pool, 5, 5, 5)
	})
	t.Run("key collision rolls back earlier demo inserts", func(t *testing.T) {
		pool, service, actor := demoDatabase(t)
		owned, err := service.Execute(t.Context(), actor, "owner", app.Command{Action: "flag_created", Name: "User owned", Key: "demo-default", Environment: "development", Enabled: true})
		if err != nil {
			t.Fatal(err)
		}
		if _, err := service.InitializeDemo(t.Context(), actor, "demo"); !errors.Is(err, app.ErrKeyConflict) {
			t.Fatalf("collision %v", err)
		}
		after, err := service.Store.Get(t.Context(), owned.ID)
		if err != nil || !reflect.DeepEqual(owned, after) {
			t.Fatal("user-owned key changed")
		}
		demoCounts(t, pool, 1, 1, 1)
	})
	t.Run("late audit rejection rolls back batch", func(t *testing.T) {
		pool, service, actor := demoDatabase(t)
		if _, err := pool.Exec(t.Context(), `ALTER TABLE audit_entries ADD CONSTRAINT reject_demo CHECK (flag_id <> 'd5d50000-0000-4000-8000-000000000004'::uuid)`); err != nil {
			t.Fatal(err)
		}
		if _, err := service.InitializeDemo(t.Context(), actor, "demo"); err == nil {
			t.Fatal("audit rejection accepted")
		}
		demoCounts(t, pool, 0, 0, 0)
	})
	t.Run("editor cannot initialize production", func(t *testing.T) {
		pool, service, actor := demoDatabase(t)
		actor.Role = "editor"
		if _, err := service.InitializeDemo(t.Context(), actor, "demo"); !errors.Is(err, app.ErrForbidden) {
			t.Fatalf("permission %v", err)
		}
		demoCounts(t, pool, 0, 0, 0)
	})
}
