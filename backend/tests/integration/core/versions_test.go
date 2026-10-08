package core_test

import (
	auditApp "didi/backend/internal/contexts/audit/application"
	auditInfra "didi/backend/internal/contexts/audit/infrastructure"
	auditPublic "didi/backend/internal/contexts/audit/public"
	app "didi/backend/internal/contexts/flags/application"
	"didi/backend/internal/contexts/flags/domain"
	repo "didi/backend/internal/contexts/flags/infrastructure"
	identity "didi/backend/internal/contexts/identity/infrastructure"
	"didi/backend/tests/support"
	"encoding/json"
	"errors"
	"github.com/jackc/pgx/v5"
	"sync"
	"testing"
	"time"
)

func TestPercentageVersionsAndFullRollback(t *testing.T) {
	pool, _, _ := support.Database(t)
	ctx := t.Context()
	if _, err := pool.Exec(ctx, `INSERT INTO users(id,username,password_hash,display_name,role) VALUES($1,'admin','unused','Admin','admin')`, actorID); err != nil {
		t.Fatal(err)
	}
	r := repo.Repository{Pool: pool, AuditFactory: func(tx pgx.Tx) app.AuditPort {
		return repo.AuditAdapter{Service: auditPublic.Service{UseCases: auditApp.Service{Appender: auditInfra.Appender{Tx: tx}}}, NewID: identity.NewID}
	}}
	service := app.Service{Store: r, Authorize: repo.Authorize, NewID: identity.NewID, Now: func() time.Time { return time.Now().UTC() }}
	actor := app.Actor{ID: actorID, Name: "Admin", Role: "admin"}
	s, err := service.Execute(ctx, actor, "r", app.Command{Action: "flag_created", Name: "Original", Key: "original", Environment: "development", Enabled: true})
	if err != nil {
		t.Fatal(err)
	}
	initial := s
	bp := 10000
	s, err = service.Execute(ctx, actor, "r", app.Command{Action: "rule_created", ID: s.ID, ExpectedRevision: 1, Rule: domain.Rule{Kind: "percentage", Priority: 2, PercentageBP: &bp, Result: true}})
	if err != nil {
		t.Fatalf("percentage persistence %v", err)
	}
	historical := s
	result, err := service.Evaluate(ctx, "development", "original", json.RawMessage(`{"user_id":"user"}`))
	if err != nil || !result.Value || result.Source != "percentage_rule" {
		t.Fatalf("evaluation %+v %v", result, err)
	}
	s, err = service.Execute(ctx, actor, "r", app.Command{Action: "flag_edited", ID: s.ID, ExpectedRevision: s.Revision, Name: "Changed", Key: "changed", DefaultValue: true})
	if err != nil {
		t.Fatal(err)
	}
	s, err = service.Execute(ctx, actor, "r", app.Command{Action: "flag_enabled", ID: s.ID, ExpectedRevision: s.Revision, Enabled: false})
	if err != nil {
		t.Fatal(err)
	}
	// Simulate a current configuration with a different seed (e.g. a later
	// environment publication), keeping the relational row and snapshot aligned.
	currentSeed := identity.NewID()
	if _, err = pool.Exec(ctx, `UPDATE flags SET seed=$2 WHERE id=$1`, s.ID, currentSeed); err != nil {
		t.Fatal(err)
	}
	if _, err = pool.Exec(ctx, `UPDATE flag_versions SET snapshot=jsonb_set(snapshot,'{Seed}',to_jsonb($3::text)) WHERE flag_id=$1 AND revision=$2`, s.ID, s.Revision, currentSeed); err != nil {
		t.Fatal(err)
	}
	page, err := service.Versions(ctx, s.ID, 50, 0)
	if err != nil || page.Total != 4 || len(page.Items) != 4 || page.Items[0].Revision != 4 || page.Items[3].Revision != 1 {
		t.Fatalf("versions %+v %v", page, err)
	}
	preview, err := service.Preview(ctx, s.ID, 2)
	if err != nil || preview.CurrentRevision != 4 || preview.SourceRevision != 2 || len(preview.Changes) != 5 {
		t.Fatalf("preview %+v %v", preview, err)
	}
	s, err = service.Execute(ctx, actor, "r", app.Command{Action: "flag_rolled_back", ID: s.ID, ExpectedRevision: 4, SourceRevision: 2})
	if err != nil || s.Revision != 5 || s.Name != historical.Name || s.Key != historical.Key || s.Enabled != historical.Enabled || s.DefaultValue != historical.DefaultValue || s.Seed != historical.Seed || s.ID != initial.ID || s.Environment != initial.Environment || !s.CreatedAt.Equal(initial.CreatedAt) || len(s.Rules) != 1 || *s.Rules[0].PercentageBP != 10000 || s.Rules[0].ID != historical.Rules[0].ID {
		t.Fatalf("restore %+v %v", s, err)
	}
	var persistedSeed string
	if err = pool.QueryRow(ctx, `SELECT seed::text FROM flags WHERE id=$1`, s.ID).Scan(&persistedSeed); err != nil || persistedSeed != historical.Seed {
		t.Fatalf("relational seed differs from the restored snapshot: %s %v", persistedSeed, err)
	}
	previous, err := service.Version(ctx, s.ID, 2)
	if err != nil || previous.Snapshot.Revision != 2 || previous.Snapshot.Key != "original" {
		t.Fatalf("history modified %+v %v", previous, err)
	}
	history, total, err := (auditInfra.Reader{Pool: pool}).List(ctx, s.ID, 50, 0)
	if err != nil || total != 5 || history[0].Action != "flag_rolled_back" {
		t.Fatalf("audit %+v %d %v", history, total, err)
	}
	var changes struct {
		Restored int64 `json:"restored_revision"`
	}
	if err = json.Unmarshal(history[0].Changes, &changes); err != nil || changes.Restored != 2 {
		t.Fatalf("restore source %v %+v", err, changes)
	}
	_, err = service.Execute(ctx, actor, "r", app.Command{Action: "flag_rolled_back", ID: s.ID, ExpectedRevision: 4, SourceRevision: 1})
	if !errors.Is(err, app.ErrConflict) {
		t.Fatalf("stale %v", err)
	}
	_, err = service.Execute(ctx, actor, "r", app.Command{Action: "flag_rolled_back", ID: s.ID, ExpectedRevision: 5, SourceRevision: 999})
	if !errors.Is(err, app.ErrVersionNotFound) {
		t.Fatalf("missing version %v", err)
	}
	// Force the historical Key to conflict with another aggregate after a rename.
	s, err = service.Execute(ctx, actor, "r", app.Command{Action: "flag_edited", ID: s.ID, ExpectedRevision: s.Revision, Name: "Changed again", Key: "later"})
	if err != nil {
		t.Fatal(err)
	}
	_, err = service.Execute(ctx, actor, "r", app.Command{Action: "flag_created", Name: "Occupied", Key: "original", Environment: "development"})
	if err != nil {
		t.Fatal(err)
	}
	_, err = service.Execute(ctx, actor, "r", app.Command{Action: "flag_rolled_back", ID: s.ID, ExpectedRevision: s.Revision, SourceRevision: 2})
	if !errors.Is(err, app.ErrKeyConflict) {
		t.Fatalf("rollback key conflict %v", err)
	}
	current, err := r.Get(ctx, s.ID)
	if err != nil || current.Revision != s.Revision || current.Key != "later" {
		t.Fatalf("partial conflict %+v %v", current, err)
	}
}

func TestRollbackFailureConcurrencyAndD2Snapshot(t *testing.T) {
	pool, _, _ := support.Database(t)
	ctx := t.Context()
	if _, err := pool.Exec(ctx, `INSERT INTO users(id,username,password_hash,display_name,role) VALUES($1,'admin','unused','Admin','admin')`, actorID); err != nil {
		t.Fatal(err)
	}
	fail := false
	r := repo.Repository{Pool: pool, AuditFactory: func(tx pgx.Tx) app.AuditPort { return auditSQL{tx, &fail} }}
	service := app.Service{Store: r, Authorize: repo.Authorize, NewID: identity.NewID, Now: time.Now}
	actor := app.Actor{ID: actorID, Name: "Admin", Role: "admin"}
	s, err := service.Execute(ctx, actor, "r", app.Command{Action: "flag_created", Name: "Original", Key: "original", Environment: "development", Enabled: true})
	if err != nil {
		t.Fatal(err)
	}
	s, err = service.Execute(ctx, actor, "r", app.Command{Action: "rule_created", ID: s.ID, ExpectedRevision: 1, Rule: domain.Rule{Priority: 1, Attribute: "n", Operator: "equals", Expected: json.RawMessage(`9007199254740993`), Result: true}})
	if err != nil {
		t.Fatal(err)
	}
	// Test setup simulates the exact D2 persisted rule format, before exercising reads.
	if _, err = pool.Exec(ctx, `UPDATE flag_versions SET snapshot=jsonb_set(snapshot,'{Rules}',(SELECT jsonb_agg(rule-'Kind'-'PercentageBP') FROM jsonb_array_elements(snapshot->'Rules') rule)) WHERE flag_id=$1 AND revision=2`, s.ID); err != nil {
		t.Fatal(err)
	}
	legacy, err := service.Version(ctx, s.ID, 2)
	if err != nil || legacy.Snapshot.Rules[0].Kind != "attribute" || string(legacy.Snapshot.Rules[0].Expected) != "9007199254740993" {
		t.Fatalf("D2 compatibility %+v %v", legacy, err)
	}
	s, err = service.Execute(ctx, actor, "r", app.Command{Action: "flag_edited", ID: s.ID, ExpectedRevision: 2, Name: "Changed", Key: "changed"})
	if err != nil {
		t.Fatal(err)
	}
	fail = true
	_, err = service.Execute(ctx, actor, "r", app.Command{Action: "flag_rolled_back", ID: s.ID, ExpectedRevision: 3, SourceRevision: 2})
	if err == nil {
		t.Fatal("failed audit accepted")
	}
	fail = false
	current, err := r.Get(ctx, s.ID)
	if err != nil || current.Revision != 3 || current.Key != "changed" {
		t.Fatalf("partial rollback %+v %v", current, err)
	}
	var versions, audits int
	if err = pool.QueryRow(ctx, `SELECT (SELECT count(*) FROM flag_versions),(SELECT count(*) FROM audit_entries)`).Scan(&versions, &audits); err != nil || versions != 3 || audits != 3 {
		t.Fatalf("partial counts %d %d %v", versions, audits, err)
	}
	gate := make(chan struct{})
	outcomes := make(chan error, 2)
	var wg sync.WaitGroup
	for i := 0; i < 2; i++ {
		wg.Go(func() {
			<-gate
			_, writeErr := service.Execute(ctx, actor, "r", app.Command{Action: "flag_rolled_back", ID: s.ID, ExpectedRevision: 3, SourceRevision: 2})
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
		t.Fatalf("concurrent restores %d/%d", success, conflict)
	}
	result, err := service.Evaluate(ctx, "development", "original", json.RawMessage(`{"n":9007199254740993}`))
	if err != nil || !result.Value || result.Revision != 4 {
		t.Fatalf("restored legacy %+v %v", result, err)
	}
	page, err := service.Versions(ctx, s.ID, 2, 100)
	if err != nil || page.Total != 4 || len(page.Items) != 0 {
		t.Fatalf("empty page %+v %v", page, err)
	}
}
