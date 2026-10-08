package application

import (
	"context"
	"didi/backend/internal/contexts/flags/domain"
	"errors"
	"testing"
	"time"
)

type fakeStore struct {
	state           domain.Snapshot
	saved, appended int
	failAudit       bool
}

func (f *fakeStore) Within(ctx context.Context, fn func(Scope) error) error { return fn(f) }
func (f *fakeStore) Load(context.Context, string) (domain.Snapshot, error)  { return f.state, nil }
func (f *fakeStore) Save(_ context.Context, s domain.Snapshot, _ Actor) error {
	f.saved++
	f.state = s
	return nil
}
func (f *fakeStore) Audit() AuditPort { return f }
func (f *fakeStore) Append(context.Context, Change) error {
	f.appended++
	if f.failAudit {
		return errors.New("audit unavailable")
	}
	return nil
}
func (f *fakeStore) Get(ctx context.Context, id string) (domain.Snapshot, error) {
	return f.Load(ctx, id)
}
func (f *fakeStore) ByKey(ctx context.Context, _, _ string) (domain.Snapshot, error) {
	return f.Load(ctx, "")
}
func (f *fakeStore) List(context.Context, Filter) (Page, error) { return Page{}, nil }
func TestCommandGuardsAndSubmission(t *testing.T) {
	for _, tc := range []struct {
		name          string
		allow         bool
		revision      int64
		auditFail     bool
		want          error
		saves, audits int
	}{
		{"permission", false, 1, false, ErrForbidden, 0, 0}, {"stale", true, 2, false, ErrConflict, 0, 0}, {"success", true, 1, false, nil, 1, 1}, {"audit failure", true, 1, true, errors.New("audit unavailable"), 1, 1},
	} {
		t.Run(tc.name, func(t *testing.T) {
			f := &fakeStore{state: domain.Snapshot{SchemaVersion: 1, ID: "id", Name: "Original", Key: "key", Environment: "development", Seed: "seed", Revision: 1, Rules: []domain.Rule{}}, failAudit: tc.auditFail}
			s := Service{Store: f, Authorize: func(Actor, string) bool { return tc.allow }, NewID: func() string { return "new" }, Now: func() time.Time { return time.Unix(20, 0) }}
			got, err := s.Execute(context.Background(), Actor{ID: "actor", Name: "Actor"}, "request", Command{Action: "flag_edited", ID: "id", Name: "Changed", Key: "key", ExpectedRevision: tc.revision})
			if tc.want == nil && err != nil || tc.want != nil && (err == nil || err.Error() != tc.want.Error()) {
				t.Fatalf("error %v", err)
			}
			if f.saved != tc.saves || f.appended != tc.audits {
				t.Fatalf("saves %d audits %d", f.saved, f.appended)
			}
			if err == nil && (got.Name != "Changed" || got.Revision != 2) {
				t.Fatalf("snapshot %+v", got)
			}
		})
	}
}
