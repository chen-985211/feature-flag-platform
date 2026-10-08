package domain

import (
	"encoding/json"
	"errors"
	"testing"
	"time"
)

func transferSource() Snapshot {
	s := fixture()
	s.Revision = 4
	s.Name = "Source"
	s.DefaultValue = true
	s.Rules = []Rule{{ID: "a", Priority: 1, Attribute: "n", Operator: "equals", Expected: json.RawMessage(`9007199254740993`), Result: false}, pct("p", 4, 2500, true)}
	return s
}
func TestCopyAndPublicationPreserveConfigurationAndTargetIdentity(t *testing.T) {
	source := transferSource()
	now := time.Unix(200, 0)
	copied, err := CopyConfiguration(source, "target", "staging", []string{"ta", "tp"}, now)
	if err != nil || copied.ID != "target" || copied.Environment != "staging" || copied.Revision != 1 || copied.Seed != source.Seed || copied.Name != source.Name || !copied.DefaultValue || !copied.CreatedAt.Equal(now) || len(copied.Rules) != 2 || copied.Rules[0].ID != "ta" || string(copied.Rules[0].Expected) != `9007199254740993` {
		t.Fatalf("copy %+v %v", copied, err)
	}
	target := fixture()
	target.ID = "target"
	target.Environment = "staging"
	target.Revision = 7
	target.CreatedAt = time.Unix(50, 0)
	target.Seed = "other"
	target.Enabled = false
	f, err := Restore(target)
	if err != nil {
		t.Fatal(err)
	}
	if err = f.Publish(source, []string{"new-a", "new-p"}); err != nil {
		t.Fatal(err)
	}
	if err = f.Advance(now); err != nil {
		t.Fatal(err)
	}
	got := f.Snapshot()
	if got.ID != target.ID || got.Key != target.Key || got.Environment != target.Environment || !got.CreatedAt.Equal(target.CreatedAt) || got.Revision != 8 || got.Seed != source.Seed || !got.Enabled || len(got.Rules) != 2 || got.Rules[1].ID != "new-p" || *got.Rules[1].PercentageBP != 2500 {
		t.Fatalf("publish %+v", got)
	}
	changes, err := PublicationDifferences(got, source)
	if err != nil || len(changes) != 0 {
		t.Fatalf("identity/time difference %+v %v", changes, err)
	}
	source.Rules[1].Result = false
	changes, err = PublicationDifferences(got, source)
	if err != nil || len(changes) != 1 || changes[0].Field != "rules" {
		t.Fatalf("content difference %+v %v", changes, err)
	}
}
func TestTransferRejectsInvalidTargetAndRuleIdentity(t *testing.T) {
	source := transferSource()
	for _, tc := range []struct {
		environment string
		ids         []string
	}{{"development", []string{"ta", "tp"}}, {"unknown", []string{"ta", "tp"}}, {"staging", []string{"a", "p"}}, {"staging", []string{"ta"}}, {"staging", []string{"ta", "ta"}}} {
		if _, err := CopyConfiguration(source, "new", tc.environment, tc.ids, time.Now()); !errors.Is(err, ErrInvalid) {
			t.Fatalf("accepted copy %+v: %v", tc, err)
		}
	}
	target := fixture()
	target.Environment = "staging"
	target.ID = "target"
	target.Key = "different"
	f, err := Restore(target)
	if err != nil {
		t.Fatal(err)
	}
	if err = f.Publish(source, []string{"ta", "tp"}); !errors.Is(err, ErrInvalid) {
		t.Fatalf("different key %v", err)
	}
	if _, err = PublicationDifferences(target, source); !errors.Is(err, ErrInvalid) {
		t.Fatalf("invalid preview %v", err)
	}
	if f.Snapshot().Name != target.Name || f.Snapshot().Seed != target.Seed {
		t.Fatal("rejected publish changed target")
	}
}
