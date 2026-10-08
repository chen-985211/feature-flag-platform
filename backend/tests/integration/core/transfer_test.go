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
	"github.com/jackc/pgx/v5/pgxpool"
	"sync"
	"testing"
	"time"
)

func transferDatabase(t *testing.T, fail *bool) (*pgxpool.Pool, app.Service, repo.Repository, app.Actor) {
	t.Helper()
	pool, _, _ := support.Database(t)
	if _, err := pool.Exec(t.Context(), `INSERT INTO users(id,username,password_hash,display_name,role) VALUES($1,'admin','unused','Admin','admin')`, actorID); err != nil {
		t.Fatal(err)
	}
	r := repo.Repository{Pool: pool, AuditFactory: func(tx pgx.Tx) app.AuditPort {
		if *fail {
			return auditSQL{tx, fail}
		}
		return repo.AuditAdapter{Service: auditPublic.Service{UseCases: auditApp.Service{Appender: auditInfra.Appender{Tx: tx}}}, NewID: identity.NewID}
	}}
	return pool, app.Service{Store: r, Authorize: repo.Authorize, NewID: identity.NewID, Now: func() time.Time { return time.Now().UTC() }}, r, app.Actor{ID: actorID, Name: "Admin", Role: "admin"}
}
func mustChange(t *testing.T, s app.Service, actor app.Actor, cmd app.Command) domain.Snapshot {
	t.Helper()
	got, err := s.Execute(t.Context(), actor, "request", cmd)
	if err != nil {
		t.Fatal(err)
	}
	return got
}
func counts(t *testing.T, pool *pgxpool.Pool) [3]int {
	t.Helper()
	var n [3]int
	if err := pool.QueryRow(t.Context(), `SELECT (SELECT count(*) FROM flags),(SELECT count(*) FROM flag_versions),(SELECT count(*) FROM audit_entries)`).Scan(&n[0], &n[1], &n[2]); err != nil {
		t.Fatal(err)
	}
	return n
}
func TestOrderingCopyAndFixedVersionPublication(t *testing.T) {
	fail := false
	pool, s, r, actor := transferDatabase(t, &fail)
	source := mustChange(t, s, actor, app.Command{Action: "flag_created", Name: "Source", Key: "transfer", Environment: "development", Enabled: true})
	source = mustChange(t, s, actor, app.Command{Action: "rule_created", ID: source.ID, ExpectedRevision: 1, Rule: domain.Rule{Priority: 5, Attribute: "n", Operator: "equals", Expected: json.RawMessage(`9007199254740993`), Result: false}})
	bp := 10000
	source = mustChange(t, s, actor, app.Command{Action: "rule_created", ID: source.ID, ExpectedRevision: 2, Rule: domain.Rule{Kind: "percentage", PercentageBP: &bp, Priority: 10, Result: true}})
	attr, pct := source.Rules[0].ID, source.Rules[1].ID
	source = mustChange(t, s, actor, app.Command{Action: "rules_reordered", ID: source.ID, ExpectedRevision: 3, RuleIDs: []string{pct, attr}})
	if source.Rules[0].ID != pct || source.Rules[0].Priority != 1 || source.Rules[1].Priority != 2 {
		t.Fatalf("reorder %+v", source.Rules)
	}
	result, err := s.Evaluate(t.Context(), "development", "transfer", json.RawMessage(`{"user_id":"alice","n":9007199254740993}`))
	if err != nil || !result.Value || result.Revision != 4 {
		t.Fatalf("reordered evaluation %+v %v", result, err)
	}
	before := counts(t, pool)
	_, err = s.Execute(t.Context(), actor, "r", app.Command{Action: "rules_reordered", ID: source.ID, ExpectedRevision: 4, RuleIDs: []string{pct, pct}})
	if !errors.Is(err, domain.ErrInvalid) || counts(t, pool) != before {
		t.Fatalf("invalid order %v", err)
	}
	target := mustChange(t, s, actor, app.Command{Action: "flag_copied", SourceID: source.ID, SourceRevision: 4, Environment: "staging"})
	if target.ID == source.ID || target.Revision != 1 || target.Seed != source.Seed || len(target.Rules) != 2 || target.Rules[0].ID == pct || string(target.Rules[1].Expected) != `9007199254740993` {
		t.Fatalf("copy %+v", target)
	}
	rule := source.Rules[0]
	rule.Result = false
	source = mustChange(t, s, actor, app.Command{Action: "rule_edited", ID: source.ID, RuleID: rule.ID, Rule: rule, ExpectedRevision: 4})
	preview, err := s.PublicationPreview(t.Context(), source.ID, 4, "staging")
	if err != nil || len(preview.Changes) != 0 || preview.SourceRevision != 4 || preview.TargetRevision != 1 {
		t.Fatalf("fixed preview %+v %v", preview, err)
	}
	preview, err = s.PublicationPreview(t.Context(), source.ID, 5, "staging")
	if err != nil || len(preview.Changes) != 1 || preview.Changes[0].Field != "rules" {
		t.Fatalf("rule diff %+v %v", preview, err)
	}
	oldTarget := target
	target = mustChange(t, s, actor, app.Command{Action: "flag_published", ID: target.ID, SourceID: source.ID, SourceRevision: 5, ExpectedRevision: 1})
	if target.ID != oldTarget.ID || target.Revision != 2 || !target.CreatedAt.Equal(oldTarget.CreatedAt) || target.Key != oldTarget.Key || target.Environment != "staging" || target.Rules[0].ID == source.Rules[0].ID || target.Rules[0].ID == oldTarget.Rules[0].ID || target.Rules[0].Result {
		t.Fatalf("publish %+v", target)
	}
	result, err = s.Evaluate(t.Context(), "staging", "transfer", json.RawMessage(`{"user_id":"alice"}`))
	if err != nil || result.Value || result.Source != "percentage_rule" || result.Revision != 2 {
		t.Fatalf("target evaluation %+v %v", result, err)
	}
	history, total, err := (auditInfra.Reader{Pool: pool}).List(t.Context(), target.ID, 50, 0)
	if err != nil || total != 2 || history[0].Action != "flag_published" || history[1].Action != "flag_copied" {
		t.Fatalf("target history %+v %v", history, err)
	}
	var changes struct {
		Source app.Source `json:"source"`
	}
	if json.Unmarshal(history[0].Changes, &changes) != nil || changes.Source.FlagID != source.ID || changes.Source.Environment != "development" || changes.Source.Revision != 5 {
		t.Fatalf("source audit %+v", changes)
	}
	legacy, err := s.Version(t.Context(), target.ID, 1)
	if err != nil || !legacy.Snapshot.Rules[0].Result {
		t.Fatalf("old target overwritten %+v %v", legacy, err)
	}
	source = mustChange(t, s, actor, app.Command{Action: "flag_edited", ID: source.ID, ExpectedRevision: 5, Name: "Current", Key: "renamed"})
	historicalCopy := mustChange(t, s, actor, app.Command{Action: "flag_copied", SourceID: source.ID, SourceRevision: 4, Environment: "production"})
	if historicalCopy.Key != "transfer" || historicalCopy.Name != "Source" || !historicalCopy.Rules[0].Result {
		t.Fatalf("current source leaked %+v", historicalCopy)
	}
	before = counts(t, pool)
	_, err = s.Execute(t.Context(), actor, "r", app.Command{Action: "flag_copied", SourceID: source.ID, SourceRevision: 4, Environment: "staging"})
	if !errors.Is(err, app.ErrKeyConflict) || counts(t, pool) != before {
		t.Fatalf("copy conflict %v", err)
	}
	target = mustChange(t, s, actor, app.Command{Action: "flag_edited", ID: target.ID, ExpectedRevision: 2, Name: "Renamed target", Key: "other"})
	before = counts(t, pool)
	_, err = s.Execute(t.Context(), actor, "r", app.Command{Action: "flag_published", ID: target.ID, SourceID: source.ID, SourceRevision: 5, ExpectedRevision: 3})
	if !errors.Is(err, domain.ErrInvalid) || counts(t, pool) != before {
		t.Fatalf("renamed target accepted %v", err)
	}
	current, err := r.Get(t.Context(), target.ID)
	if err != nil || current.Key != "other" || current.Revision != 3 {
		t.Fatalf("partial publish %+v %v", current, err)
	}
}
func TestTransferFailureAndConcurrentWrites(t *testing.T) {
	fail := false
	pool, s, r, actor := transferDatabase(t, &fail)
	source := mustChange(t, s, actor, app.Command{Action: "flag_created", Name: "Source", Key: "atomic", Environment: "development", Enabled: true})
	bp := 10000
	source = mustChange(t, s, actor, app.Command{Action: "rule_created", ID: source.ID, ExpectedRevision: 1, Rule: domain.Rule{Kind: "percentage", Priority: 9, PercentageBP: &bp, Result: true}})
	target := mustChange(t, s, actor, app.Command{Action: "flag_copied", SourceID: source.ID, SourceRevision: 2, Environment: "staging"})
	for _, cmd := range []app.Command{{Action: "rules_reordered", ID: source.ID, ExpectedRevision: 2, RuleIDs: []string{source.Rules[0].ID}}, {Action: "flag_copied", SourceID: source.ID, SourceRevision: 2, Environment: "production"}, {Action: "flag_published", ID: target.ID, ExpectedRevision: 1, SourceID: source.ID, SourceRevision: 2}} {
		before := counts(t, pool)
		fail = true
		_, err := s.Execute(t.Context(), actor, "r", cmd)
		fail = false
		if err == nil || counts(t, pool) != before {
			t.Fatalf("partial failed %s %v", cmd.Action, err)
		}
		a, err := r.Get(t.Context(), source.ID)
		if err != nil || a.Revision != 2 || a.Rules[0].Priority != 9 {
			t.Fatal("partial source")
		}
		b, err := r.Get(t.Context(), target.ID)
		if err != nil || b.Revision != 1 {
			t.Fatal("partial target")
		}
	}
	for _, cmd := range []app.Command{{Action: "rules_reordered", ID: source.ID, ExpectedRevision: 2, RuleIDs: []string{source.Rules[0].ID}}, {Action: "flag_published", ID: target.ID, ExpectedRevision: 1, SourceID: source.ID, SourceRevision: 2}, {Action: "flag_copied", SourceID: source.ID, SourceRevision: 2, Environment: "production"}} {
		gate := make(chan struct{})
		results := make(chan error, 2)
		var wg sync.WaitGroup
		for i := 0; i < 2; i++ {
			wg.Go(func() { <-gate; _, err := s.Execute(t.Context(), actor, "r", cmd); results <- err })
		}
		close(gate)
		wg.Wait()
		close(results)
		success, conflict := 0, 0
		for err := range results {
			switch {
			case err == nil:
				success++
			case errors.Is(err, app.ErrConflict) || errors.Is(err, app.ErrKeyConflict):
				conflict++
			default:
				t.Fatalf("%s unexpected result: %v", cmd.Action, err)
			}
		}
		if success != 1 || conflict != 1 {
			t.Fatalf("%s race %d/%d", cmd.Action, success, conflict)
		}
	}
}

func TestPublicationUpdatesExistingTargetSeed(t *testing.T) {
	fail := false
	pool, s, _, actor := transferDatabase(t, &fail)
	source := mustChange(t, s, actor, app.Command{Action: "flag_created", Name: "Source", Key: "seed-sync", Environment: "development", Enabled: true})
	bp := 10000
	source = mustChange(t, s, actor, app.Command{Action: "rule_created", ID: source.ID, ExpectedRevision: 1, Rule: domain.Rule{Kind: "percentage", Priority: 1, PercentageBP: &bp, Result: true}})
	target := mustChange(t, s, actor, app.Command{Action: "flag_created", Name: "Existing", Key: "seed-sync", Environment: "staging", DefaultValue: true})
	if source.Seed == target.Seed {
		t.Fatal("fixture requires independent target seed")
	}
	preview, err := s.PublicationPreview(t.Context(), source.ID, 2, "staging")
	if err != nil || len(preview.Changes) != 5 {
		t.Fatalf("complete preview %+v %v", preview, err)
	}
	published := mustChange(t, s, actor, app.Command{Action: "flag_published", ID: target.ID, ExpectedRevision: 1, SourceID: source.ID, SourceRevision: 2})
	var seed string
	if err = pool.QueryRow(t.Context(), `SELECT seed::text FROM flags WHERE id=$1`, target.ID).Scan(&seed); err != nil || seed != source.Seed || published.Seed != source.Seed || !published.Enabled || published.DefaultValue || published.Name != "Source" {
		t.Fatalf("complete target %+v %s %v", published, seed, err)
	}
	result, err := s.Evaluate(t.Context(), "staging", "seed-sync", json.RawMessage(`{"user_id":"alice"}`))
	if err != nil || !result.Value || result.Revision != 2 || result.Source != "percentage_rule" {
		t.Fatalf("published evaluation %+v %v", result, err)
	}
}
