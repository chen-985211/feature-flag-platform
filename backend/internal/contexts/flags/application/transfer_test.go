package application

import (
	"context"
	"didi/backend/internal/contexts/flags/domain"
	"errors"
	"fmt"
	"testing"
	"time"
)

type transferStore struct {
	*fakeStore
	source  domain.Snapshot
	change  Change
	missing bool
}
type transferScope struct {
	fakeScope
	store *transferStore
}

func (f *transferStore) Within(ctx context.Context, fn func(Scope) error) error {
	return fn(transferScope{fakeScope{f.fakeStore}, f})
}
func (f *transferStore) Version(_ context.Context, id string, rev int64) (Version, error) {
	if id != f.source.ID || rev != f.source.Revision {
		return Version{}, ErrVersionNotFound
	}
	return Version{VersionSummary: VersionSummary{Revision: rev}, Snapshot: f.source}, nil
}
func (f transferScope) Version(ctx context.Context, id string, rev int64) (domain.Snapshot, error) {
	v, err := f.store.Version(ctx, id, rev)
	return v.Snapshot, err
}
func (f transferScope) Audit() AuditPort { return f.store }
func (f *transferStore) Append(ctx context.Context, c Change) error {
	f.change = c
	return f.fakeStore.Append(ctx, c)
}
func (f *transferStore) ByKey(ctx context.Context, env, key string) (domain.Snapshot, error) {
	if f.missing || env != f.state.Environment || key != f.state.Key {
		return domain.Snapshot{}, ErrNotFound
	}
	return f.state, nil
}
func transferFixture() (*transferStore, Service) {
	bp := 10000
	source := domain.Snapshot{SchemaVersion: 1, ID: "source", Name: "Fixed", Key: "key", Environment: "development", Seed: "source-seed", Revision: 4, Enabled: true, Rules: []domain.Rule{{ID: "sr", Kind: "percentage", PercentageBP: &bp, Priority: 2, Result: true}}}
	target := domain.Snapshot{SchemaVersion: 1, ID: "target", Name: "Old", Key: "key", Environment: "staging", Seed: "target-seed", Revision: 5, Rules: []domain.Rule{}, CreatedAt: time.Unix(1, 0)}
	store := &transferStore{fakeStore: &fakeStore{state: target}, source: source}
	count := 0
	service := Service{Store: store, Authorize: func(Actor, string) bool { return true }, Now: func() time.Time { return time.Unix(50, 0) }, NewID: func() string { count++; return fmt.Sprintf("new-%d", count) }}
	return store, service
}
func TestTransferCommandsUseFixedSourceAndAtomicSubmission(t *testing.T) {
	for _, action := range []string{"flag_copied", "flag_published"} {
		t.Run(action, func(t *testing.T) {
			store, service := transferFixture()
			env := ""
			service.Authorize = func(_ Actor, e string) bool { env = e; return true }
			got, err := service.Execute(t.Context(), Actor{ID: "actor", Name: "Actor"}, "request", Command{Action: action, ID: "target", Environment: "staging", SourceID: "source", SourceRevision: 4, ExpectedRevision: 5})
			if err != nil || got.Environment != "staging" || got.Name != "Fixed" || got.Seed != "source-seed" || len(got.Rules) != 1 || got.Rules[0].ID == "sr" || env != "staging" || store.saved != 1 || store.appended != 1 || store.change.Source == nil || store.change.Source.FlagID != "source" || store.change.Source.Revision != 4 || store.change.RestoredRevision != 0 {
				t.Fatalf("transfer %+v %+v %v", got, store.change, err)
			}
			if action == "flag_copied" && (got.Revision != 1 || got.ID == "target" || store.change.Before != nil) {
				t.Fatal("copy overwrote target")
			}
			if action == "flag_published" && (got.Revision != 6 || got.ID != "target" || !got.CreatedAt.Equal(time.Unix(1, 0)) || store.change.Before == nil) {
				t.Fatal("publish replaced target identity")
			}
		})
	}
}
func TestTransferRejectsBeforeSavingAndBindsPreview(t *testing.T) {
	store, service := transferFixture()
	preview, err := service.PublicationPreview(t.Context(), "source", 4, "staging")
	if err != nil || preview.SourceRevision != 4 || preview.TargetRevision != 5 || preview.Target.ID != "target" || preview.Source.Name != "Fixed" || len(preview.Changes) != 4 {
		t.Fatalf("preview %+v %v", preview, err)
	}
	store.missing = true
	if _, err = service.PublicationPreview(t.Context(), "source", 4, "staging"); !errors.Is(err, ErrTargetNotFound) {
		t.Fatalf("missing target %v", err)
	}
	for _, tc := range []struct {
		action   string
		allow    bool
		expected int64
		source   int64
		want     error
	}{{"flag_copied", false, 5, 4, ErrForbidden}, {"flag_published", false, 5, 4, ErrForbidden}, {"flag_published", true, 4, 4, ErrConflict}, {"flag_published", true, 5, 99, ErrVersionNotFound}} {
		store, service = transferFixture()
		service.Authorize = func(Actor, string) bool { return tc.allow }
		_, err = service.Execute(t.Context(), Actor{ID: "actor", Name: "Actor"}, "request", Command{Action: tc.action, ID: "target", Environment: "staging", ExpectedRevision: tc.expected, SourceID: "source", SourceRevision: tc.source})
		if !errors.Is(err, tc.want) || store.saved != 0 || store.appended != 0 {
			t.Fatalf("guard %+v saves %d error %v", tc, store.saved, err)
		}
	}
}
