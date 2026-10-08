package application

import (
	"context"
	"didi/backend/internal/contexts/flags/domain"
	"encoding/json"
	"errors"
	"reflect"
	"testing"
	"time"
)

type demoStore struct {
	*fakeStore
	states  map[string]domain.Snapshot
	changes []Change
}
type demoScope struct {
	fakeScope
	store *demoStore
}

func (s *demoStore) Within(ctx context.Context, fn func(Scope) error) error {
	return fn(demoScope{fakeScope{s.fakeStore}, s})
}
func (s demoScope) Create(_ context.Context, snapshot domain.Snapshot, _ Actor) (bool, error) {
	if _, exists := s.store.states[snapshot.ID]; exists {
		return false, nil
	}
	s.store.states[snapshot.ID] = snapshot
	return true, nil
}
func (s demoScope) Audit() AuditPort { return s.store }
func (s *demoStore) Append(_ context.Context, change Change) error {
	s.changes = append(s.changes, change)
	return nil
}
func demoFixture() (*demoStore, Service, Actor) {
	store := &demoStore{fakeStore: &fakeStore{}, states: map[string]domain.Snapshot{}}
	return store, Service{Store: store, Authorize: func(actor Actor, _ string) bool { return actor.Role == "admin" }, Now: func() time.Time { return time.Unix(100, 0).UTC() }}, Actor{ID: "admin", Name: "Real Admin", Role: "admin"}
}
func TestDemoCreatesCompleteConfigurationsAndPreservesEdits(t *testing.T) {
	store, service, actor := demoFixture()
	result, err := service.InitializeDemo(t.Context(), actor, "seed-request")
	if err != nil || result.Created != 5 || result.Preserved != 0 || len(store.states) != 5 || len(store.changes) != 5 {
		t.Fatalf("initialization %+v states %d audit %d: %v", result, len(store.states), len(store.changes), err)
	}
	for _, change := range store.changes {
		if change.Action != "flag_created" || change.Before != nil || change.Actor != actor || change.RequestID != "seed-request" || change.After.Revision != 1 {
			t.Fatalf("false creation history %+v", change)
		}
		if _, err := domain.Restore(change.After); err != nil {
			t.Fatal(err)
		}
	}
	for id, snapshot := range store.states {
		snapshot.Name, snapshot.Key, snapshot.Seed, snapshot.Revision = "User edit", "user-key-"+id, "user-seed", 2
		snapshot.Rules = []domain.Rule{}
		store.states[id] = snapshot
	}
	before := make(map[string]domain.Snapshot)
	for id, snapshot := range store.states {
		before[id] = snapshot
	}
	result, err = service.InitializeDemo(t.Context(), actor, "repeat")
	if err != nil || result.Created != 0 || result.Preserved != 5 || !reflect.DeepEqual(before, store.states) || len(store.changes) != 5 {
		t.Fatalf("repeat overwrote data %+v %v", result, err)
	}
}
func TestDemoExamplesAndAuthorization(t *testing.T) {
	store, service, actor := demoFixture()
	if _, err := service.InitializeDemo(t.Context(), actor, "r"); err != nil {
		t.Fatal(err)
	}
	for _, tc := range []struct {
		key, attributes, source string
		value                   bool
	}{
		{"demo-checkout", `{"tier":"blocked","country":"CN","user_id":"alice"}`, "attribute_rule", false},
		{"demo-checkout", `{"country":"CN"}`, "attribute_rule", true},
		{"demo-checkout", `{}`, "default", false},
		{"demo-checkout", `{"user_id":"demo-user-4"}`, "percentage_rule", true},
		{"demo-checkout", `{"user_id":"alice"}`, "default", false},
		{"demo-off", `{"country":"CN"}`, "disabled", false},
		{"demo-default", `{}`, "default", true},
	} {
		var snapshot domain.Snapshot
		for _, s := range store.states {
			if s.Environment == "development" && s.Key == tc.key {
				snapshot = s
			}
		}
		got, err := domain.Evaluate(snapshot, json.RawMessage(tc.attributes))
		if err != nil || got.Value != tc.value || got.Source != tc.source || got.Revision != 1 {
			t.Fatalf("example %s %+v %v", tc.key, got, err)
		}
	}
	for _, invalid := range []Actor{{ID: "admin", Name: "", Role: "admin"}, {ID: "", Name: "Admin", Role: "admin"}, {ID: "editor", Name: "Editor", Role: "editor"}, {ID: "viewer", Name: "Viewer", Role: "viewer"}} {
		store, service, _ = demoFixture()
		if _, err := service.InitializeDemo(t.Context(), invalid, "r"); !errors.Is(err, ErrForbidden) || len(store.states) != 0 {
			t.Fatalf("actor bypass %+v %v", invalid, err)
		}
	}
	store, service, actor = demoFixture()
	if _, err := service.InitializeDemo(t.Context(), actor, ""); !errors.Is(err, ErrForbidden) || len(store.states) != 0 {
		t.Fatalf("missing request ID %v", err)
	}
}
