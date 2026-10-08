package domain

import (
	"encoding/json"
	"errors"
	"testing"
)

func TestCompleteOrderPreservesRuleContent(t *testing.T) {
	s := fixture()
	s.Rules = []Rule{{ID: "a", Priority: 3, Attribute: "n", Operator: "equals", Expected: json.RawMessage(`9007199254740993`), Result: false}, pct("p", 9, 7500, true)}
	f, err := Restore(s)
	if err != nil {
		t.Fatal(err)
	}
	if err = f.Reorder([]string{"p", "a"}); err != nil {
		t.Fatal(err)
	}
	got := f.Snapshot()
	if got.Seed != s.Seed || got.Rules[0].ID != "p" || got.Rules[0].Priority != 1 || *got.Rules[0].PercentageBP != 7500 || got.Rules[1].ID != "a" || got.Rules[1].Priority != 2 || string(got.Rules[1].Expected) != `9007199254740993` || got.Rules[1].Result {
		t.Fatalf("incomplete reorder %+v", got)
	}
	for _, ids := range [][]string{nil, {"p"}, {"p", "p"}, {"p", "foreign"}, {"p", "a", "extra"}} {
		if err = f.Reorder(ids); !errors.Is(err, ErrInvalid) {
			t.Fatalf("accepted %v: %v", ids, err)
		}
		after := f.Snapshot()
		if after.Rules[0].ID != "p" || after.Rules[1].Priority != 2 {
			t.Fatal("invalid order partially applied")
		}
	}
	empty, err := Restore(fixture())
	if err != nil {
		t.Fatal(err)
	}
	if err = empty.Reorder([]string{}); err != nil {
		t.Fatal(err)
	}
}
