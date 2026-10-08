package core_test

import (
	"context"
	auditApp "didi/backend/internal/contexts/audit/application"
	auditInfra "didi/backend/internal/contexts/audit/infrastructure"
	auditPublic "didi/backend/internal/contexts/audit/public"
	app "didi/backend/internal/contexts/flags/application"
	"didi/backend/internal/contexts/flags/domain"
	repo "didi/backend/internal/contexts/flags/infrastructure"
	identityInfra "didi/backend/internal/contexts/identity/infrastructure"
	"didi/backend/tests/support"
	"encoding/json"
	"errors"
	"fmt"
	"github.com/jackc/pgx/v5"
	"sync"
	"testing"
	"time"
)

const actorID = "00000000-0000-4000-8000-000000000001"

type auditSQL struct {
	tx   pgx.Tx
	fail *bool
}

func (a auditSQL) Append(ctx context.Context, c app.Change) error {
	request := c.RequestID
	if *a.fail {
		request = ""
	}
	_, err := a.tx.Exec(ctx, `INSERT INTO audit_entries(id,flag_id,revision,actor_id,actor_name,action,changes,request_id) VALUES(gen_random_uuid(),$1,$2,$3,$4,$5,$6,$7)`, c.After.ID, c.After.Revision, c.Actor.ID, c.Actor.Name, c.Action, `{"tested":true}`, request)
	return err
}
func TestAtomicWritesAndConcurrentRevisions(t *testing.T) {
	pool, _, _ := support.Database(t)
	ctx := context.Background()
	if _, err := pool.Exec(ctx, `INSERT INTO users(id,username,password_hash,display_name,role) VALUES($1,'admin','unused','Admin','admin')`, actorID); err != nil {
		t.Fatal(err)
	}
	fail := false
	r := repo.Repository{Pool: pool, AuditFactory: func(tx pgx.Tx) app.AuditPort { return auditSQL{tx, &fail} }}
	counter := 0
	service := app.Service{Store: r, Authorize: func(app.Actor, string) bool { return true }, NewID: func() string { counter++; return fmt.Sprintf("00000000-0000-4000-8000-%012d", counter+100) }, Now: func() time.Time { return time.Now().UTC() }}
	actor := app.Actor{ID: actorID, Name: "Admin", Role: "admin"}
	s, err := service.Execute(ctx, actor, "request", app.Command{Action: "flag_created", Name: "Checkout", Key: "checkout", Environment: "development", Enabled: true})
	if err != nil || s.Revision != 1 {
		t.Fatalf("creation %+v %v", s, err)
	}
	_, err = service.Execute(ctx, actor, "request", app.Command{Action: "flag_created", Name: "Duplicate", Key: "checkout", Environment: "development"})
	if !errors.Is(err, app.ErrKeyConflict) {
		t.Fatalf("duplicate %v", err)
	}
	s, err = service.Execute(ctx, actor, "request", app.Command{Action: "rule_created", ID: s.ID, ExpectedRevision: 1, Rule: domain.Rule{Priority: 1, Attribute: "country", Operator: "equals", Expected: json.RawMessage(`"cn"`), Result: true}})
	if err != nil || s.Revision != 2 {
		t.Fatalf("rule %+v %v", s, err)
	}
	result, err := service.Evaluate(ctx, "development", "checkout", json.RawMessage(`{"country":"cn"}`))
	if err != nil || !result.Value || result.Revision != 2 {
		t.Fatalf("evaluate %+v %v", result, err)
	}
	fail = true
	_, err = service.Execute(ctx, actor, "request", app.Command{Action: "flag_edited", ID: s.ID, ExpectedRevision: 2, Name: "Must rollback", Key: "changed"})
	if err == nil {
		t.Fatal("audit failure accepted")
	}
	fail = false
	current, err := r.Get(ctx, s.ID)
	if err != nil || current.Key != "checkout" || current.Revision != 2 || len(current.Rules) != 1 {
		t.Fatalf("partial %+v %v", current, err)
	}
	var versions, audits, flags int
	if err = pool.QueryRow(ctx, `SELECT (SELECT count(*) FROM flag_versions),(SELECT count(*) FROM audit_entries),(SELECT count(*) FROM flags)`).Scan(&versions, &audits, &flags); err != nil || versions != 2 || audits != 2 || flags != 1 {
		t.Fatalf("counts %d/%d/%d %v", versions, audits, flags, err)
	}
	gate := make(chan struct{})
	outcomes := make(chan error, 2)
	var wg sync.WaitGroup
	for i := 0; i < 2; i++ {
		wg.Go(func() {
			<-gate
			_, writeErr := service.Execute(ctx, actor, "request", app.Command{Action: "flag_enabled", ID: s.ID, ExpectedRevision: 2, Enabled: false})
			outcomes <- writeErr
		})
	}
	close(gate)
	wg.Wait()
	close(outcomes)
	success, conflict := 0, 0
	for outcome := range outcomes {
		switch {
		case outcome == nil:
			success++
		case errors.Is(outcome, app.ErrConflict):
			conflict++
		default:
			t.Fatal(outcome)
		}
	}
	if success != 1 || conflict != 1 {
		t.Fatalf("concurrency %d/%d", success, conflict)
	}
}

func TestRulesQueriesAndHistoricalKeys(t *testing.T) {
	pool, _, _ := support.Database(t)
	ctx := t.Context()
	if _, err := pool.Exec(ctx, `INSERT INTO users(id,username,password_hash,display_name,role) VALUES($1,'admin','unused','Admin','admin')`, actorID); err != nil {
		t.Fatal(err)
	}
	r := repo.Repository{Pool: pool, AuditFactory: func(tx pgx.Tx) app.AuditPort {
		return repo.AuditAdapter{Service: auditPublic.Service{UseCases: auditApp.Service{Appender: auditInfra.Appender{Tx: tx}}}, NewID: identityInfra.NewID}
	}}
	service := app.Service{Store: r, Authorize: repo.Authorize, NewID: identityInfra.NewID, Now: time.Now}
	actor := app.Actor{ID: actorID, Name: "Admin", Role: "admin"}
	s, err := service.Execute(ctx, actor, "r", app.Command{Action: "flag_created", Name: "100% rollout", Key: "old_key", Environment: "development", Enabled: true})
	if err != nil {
		t.Fatal(err)
	}
	_, err = service.Execute(ctx, actor, "r", app.Command{Action: "flag_created", Name: "Other", Key: "other", Environment: "development", Enabled: false})
	if err != nil {
		t.Fatal(err)
	}
	page, err := r.List(ctx, app.Filter{Environment: "development", Query: "%", Limit: 50})
	if err != nil || page.Total != 1 || len(page.Items) != 1 || page.Items[0].ID != s.ID {
		t.Fatalf("literal search %+v %v", page, err)
	}
	page, err = r.List(ctx, app.Filter{Environment: "development", Limit: 1, Offset: 100})
	if err != nil || page.Total != 2 || len(page.Items) != 0 {
		t.Fatalf("empty page %+v %v", page, err)
	}
	for i := 1; i <= 2; i++ {
		s, err = service.Execute(ctx, actor, "r", app.Command{Action: "rule_created", ID: s.ID, ExpectedRevision: s.Revision, Rule: domain.Rule{Priority: i, Attribute: "tier", Operator: "in", Expected: json.RawMessage(`[1,2]`), Result: i != 1}})
		if err != nil {
			t.Fatal(err)
		}
	}
	_, err = service.Execute(ctx, actor, "r", app.Command{Action: "rule_created", ID: s.ID, ExpectedRevision: s.Revision, Rule: domain.Rule{Priority: 1, Attribute: "tier", Operator: "equals", Expected: json.RawMessage(`1`)}})
	if !errors.Is(err, domain.ErrPriority) {
		t.Fatalf("duplicate priority %v", err)
	}
	rule := s.Rules[0]
	rule.Priority = 3
	rule.Expected = json.RawMessage(`[3,4]`)
	s, err = service.Execute(ctx, actor, "r", app.Command{Action: "rule_edited", ID: s.ID, RuleID: rule.ID, ExpectedRevision: s.Revision, Rule: rule})
	if err != nil || s.Rules[1].ID != rule.ID {
		t.Fatalf("updated order %+v %v", s.Rules, err)
	}
	s, err = service.Execute(ctx, actor, "r", app.Command{Action: "rule_deleted", ID: s.ID, RuleID: rule.ID, ExpectedRevision: s.Revision})
	if err != nil || len(s.Rules) != 1 {
		t.Fatalf("deleted %+v %v", s, err)
	}
	s, err = service.Execute(ctx, actor, "r", app.Command{Action: "flag_edited", ID: s.ID, Name: "Renamed", Key: "new_key", ExpectedRevision: s.Revision})
	if err != nil {
		t.Fatal(err)
	}
	history, total, err := (auditInfra.Reader{Pool: pool}).List(ctx, s.ID, 50, 0)
	if err != nil || total != 6 || len(history) != 6 || history[0].Key != "new_key" || history[5].Key != "old_key" || history[0].Revision != s.Revision {
		t.Fatalf("historical keys %+v %d %v", history, total, err)
	}
	_, err = service.Execute(ctx, actor, "r", app.Command{Action: "flag_edited", ID: s.ID, Name: "Duplicate", Key: "other", ExpectedRevision: s.Revision})
	if !errors.Is(err, app.ErrKeyConflict) {
		t.Fatalf("rename conflict %v", err)
	}
	current, err := r.Get(ctx, s.ID)
	if err != nil || current.Revision != s.Revision || current.Key != "new_key" {
		t.Fatalf("rename partially written %+v %v", current, err)
	}
}

func TestNumericLexemesSurviveJSONBStorage(t *testing.T) {
	pool, _, _ := support.Database(t)
	ctx := t.Context()
	if _, err := pool.Exec(ctx, `INSERT INTO users(id,username,password_hash,display_name,role) VALUES($1,'admin','unused','Admin','admin')`, actorID); err != nil {
		t.Fatal(err)
	}
	fail := false
	r := repo.Repository{Pool: pool, AuditFactory: func(tx pgx.Tx) app.AuditPort { return auditSQL{tx, &fail} }}
	service := app.Service{Store: r, Authorize: repo.Authorize, NewID: identityInfra.NewID, Now: time.Now}
	actor := app.Actor{ID: actorID, Name: "Admin", Role: "admin"}
	s, err := service.Execute(ctx, actor, "r", app.Command{Action: "flag_created", Name: "Exact", Key: "exact", Environment: "development", Enabled: true})
	if err != nil {
		t.Fatal(err)
	}
	s, err = service.Execute(ctx, actor, "r", app.Command{Action: "rule_created", ID: s.ID, ExpectedRevision: 1, Rule: domain.Rule{Priority: 1, Attribute: "n", Operator: "equals", Expected: json.RawMessage(`1e1000`), Result: true}})
	if err != nil {
		t.Fatal(err)
	}
	restored, err := r.Get(ctx, s.ID)
	if err != nil || string(restored.Rules[0].Expected) != "1e1000" {
		t.Fatalf("numeric text changed across JSONB: %v", err)
	}
	result, err := service.Evaluate(ctx, "development", "exact", json.RawMessage(`{"n":1e1000}`))
	if err != nil || !result.Value {
		t.Fatalf("exact evaluate %+v %v", result, err)
	}
}
