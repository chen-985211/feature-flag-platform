package domain

import (
	"encoding/json"
	"errors"
	"strings"
	"testing"
)

func fixture() Snapshot {
	return Snapshot{SchemaVersion: 1, ID: "a", Name: "Checkout", Key: "checkout", Environment: "development", Seed: "seed", Enabled: true, Revision: 1, Rules: []Rule{}}
}
func TestEvaluation(t *testing.T) {
	for _, tc := range []struct {
		name, operator, expected, attrs string
		want                            bool
		status                          string
	}{
		{"string", "equals", `"cn"`, `{"country":"cn"}`, true, "hit"},
		{"no coercion", "equals", `1`, `{"country":"1"}`, false, "miss"},
		{"exact number", "equals", `9007199254740993`, `{"country":9007199254740992}`, false, "miss"},
		{"numeric exponent", "equals", `1.0`, `{"country":1e0}`, true, "hit"},
		{"in bool", "in", `[true,false]`, `{"country":false}`, true, "hit"},
		{"missing", "equals", `1`, `{}`, false, "missing"},
		{"null", "equals", `1`, `{"country":null}`, false, "miss"},
		{"array", "in", `[1,2]`, `{"country":[1]}`, false, "miss"},
		{"dot literal", "equals", `1`, `{"country.x":1}`, false, "missing"},
	} {
		t.Run(tc.name, func(t *testing.T) {
			s := fixture()
			s.Rules = []Rule{{ID: "rule", Priority: 1, Attribute: "country", Operator: tc.operator, Expected: json.RawMessage(tc.expected), Result: true}}
			got, err := Evaluate(s, json.RawMessage(tc.attrs))
			if err != nil || got.Value != tc.want || len(got.Trace) != 1 || got.Trace[0].Status != tc.status {
				t.Fatalf("got %+v error %v", got, err)
			}
		})
	}
}
func TestFirstFalseAndDisabled(t *testing.T) {
	s := fixture()
	s.DefaultValue = true
	s.Rules = []Rule{{ID: "later", Priority: 20, Attribute: "a", Operator: "equals", Expected: json.RawMessage(`true`), Result: true}, {ID: "first", Priority: 1, Attribute: "a", Operator: "equals", Expected: json.RawMessage(`true`), Result: false}}
	got, err := Evaluate(s, json.RawMessage(`{"a":true}`))
	if err != nil || got.Value || got.Source != "attribute_rule" || got.MatchedRuleID == nil || *got.MatchedRuleID != "first" || len(got.Trace) != 2 || got.Trace[1].Status != "skipped" {
		t.Fatalf("first false: %+v %v", got, err)
	}
	s.Enabled = false
	got, err = Evaluate(s, json.RawMessage(`{}`))
	if err != nil || got.Value || got.Source != "disabled" || got.UsedDefault {
		t.Fatalf("disabled: %+v %v", got, err)
	}
	s.Enabled = true
	s.Rules = nil
	got, err = Evaluate(s, json.RawMessage(`{}`))
	if err != nil || !got.Value || !got.UsedDefault || got.Source != "default" {
		t.Fatalf("default: %+v %v", got, err)
	}
}
func TestRejectInvalidInputAndPriority(t *testing.T) {
	for _, raw := range []string{`null`, `[]`, `1`, `{"a":1} {}`} {
		if _, err := Evaluate(fixture(), json.RawMessage(raw)); !errors.Is(err, ErrInvalid) {
			t.Errorf("accepted attrs %s", raw)
		}
	}
	for _, raw := range []string{`[]`, `[1,"1"]`, `[null]`, `[{}]`, `[[]]`} {
		f, restoreErr := Restore(fixture())
		if restoreErr != nil {
			t.Fatal(restoreErr)
		}
		err := f.AddRule(Rule{ID: "r", Priority: 1, Attribute: "a", Operator: "in", Expected: json.RawMessage(raw)})
		if !errors.Is(err, ErrInvalid) {
			t.Errorf("accepted expected %s", raw)
		}
	}
	f, restoreErr := Restore(fixture())
	if restoreErr != nil {
		t.Fatal(restoreErr)
	}
	r := Rule{ID: "one", Priority: 1, Attribute: "a", Operator: "equals", Expected: json.RawMessage(`1`)}
	if err := f.AddRule(r); err != nil {
		t.Fatal(err)
	}
	r.ID = "two"
	if err := f.AddRule(r); !errors.Is(err, ErrPriority) {
		t.Fatalf("duplicate: %v", err)
	}
}

func TestAggregateMutationsAndOwnership(t *testing.T) {
	f, err := Restore(fixture())
	if err != nil {
		t.Fatal(err)
	}
	rule := Rule{ID: "a", Priority: 1, Attribute: "field", Operator: "equals", Expected: json.RawMessage(`1`)}
	if err = f.AddRule(rule); err != nil {
		t.Fatal(err)
	}
	snapshot := f.Snapshot()
	snapshot.Rules[0].Expected[0] = '2'
	if string(f.Snapshot().Rules[0].Expected) != "1" {
		t.Fatal("snapshot leaked mutable expected")
	}
	rule.Expected = json.RawMessage(`true`)
	rule.Result = true
	if err = f.UpdateRule(rule); err != nil {
		t.Fatal(err)
	}
	if err = f.Edit("New", "changed", true); err != nil {
		t.Fatal(err)
	}
	if err = f.DeleteRule("missing"); !errors.Is(err, ErrRuleNotFound) {
		t.Fatalf("missing %v", err)
	}
	if err = f.DeleteRule("a"); err != nil {
		t.Fatal(err)
	}
	if len(f.Snapshot().Rules) != 0 || f.Snapshot().Seed != "seed" || f.Snapshot().Environment != "development" {
		t.Fatal("aggregate identity changed")
	}
}

func TestConfigurationSizeIsBounded(t *testing.T) {
	s := fixture()
	s.Rules = []Rule{{ID: "one", Priority: 1, Attribute: "a", Operator: "equals", Expected: json.RawMessage(`"` + strings.Repeat("x", 25000) + `"`)}}
	if _, err := Restore(s); !errors.Is(err, ErrInvalid) {
		t.Fatalf("unbounded snapshot accepted: %v", err)
	}
}
