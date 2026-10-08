package domain

import (
	"encoding/json"
	"testing"
	"time"
)

func TestRestoreContentPreservesIdentityAndAdvances(t *testing.T) {
	current := fixture()
	current.Revision = 9
	current.Name = "Now"
	current.Key = "now"
	current.CreatedAt = time.Unix(20, 0)
	current.Rules = []Rule{pct("now", 1, 10, true)}
	source := fixture()
	source.Revision = 2
	source.Name = "Old"
	source.Key = "old"
	source.Enabled = false
	source.DefaultValue = true
	source.Seed = "historical"
	source.CreatedAt = time.Unix(1, 0)
	source.Rules = []Rule{pct("pct", 3, 7500, false), {ID: "attr", Priority: 1, Attribute: "tier", Operator: "equals", Expected: json.RawMessage(`9007199254740993`), Result: true}}
	f, err := Restore(current)
	if err != nil {
		t.Fatal(err)
	}
	if err = f.ApplyVersion(source); err != nil {
		t.Fatal(err)
	}
	now := time.Unix(100, 0)
	if err = f.Advance(now); err != nil {
		t.Fatal(err)
	}
	s := f.Snapshot()
	if s.ID != current.ID || s.Environment != current.Environment || !s.CreatedAt.Equal(current.CreatedAt) || s.Revision != 10 || !s.UpdatedAt.Equal(now) || s.Name != "Old" || s.Key != "old" || s.Enabled || !s.DefaultValue || s.Seed != "historical" || len(s.Rules) != 2 || s.Rules[0].ID != "attr" || *s.Rules[1].PercentageBP != 7500 {
		t.Fatalf("incomplete restore %+v", s)
	}
}
func TestDifferencesIgnoreTechnicalTime(t *testing.T) {
	a := fixture()
	b := fixture()
	b.Revision = 3
	b.UpdatedAt = time.Unix(100, 0)
	changes, err := Differences(a, b)
	if err != nil || len(changes) != 0 {
		t.Fatalf("time noise %+v %v", changes, err)
	}
	b.Name = "Changed"
	b.Rules = []Rule{pct("p", 1, 10, false)}
	changes, err = Differences(a, b)
	if err != nil || len(changes) != 2 || changes[0].Field != "name" || changes[1].Field != "rules" {
		t.Fatalf("missing diffs %+v %v", changes, err)
	}
}
