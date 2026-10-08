package domain

import (
	"encoding/json"
	"errors"
	"testing"
)

func pct(id string, priority, bp int, result bool) Rule {
	return Rule{ID: id, Priority: priority, Kind: "percentage", PercentageBP: &bp, Result: result}
}
func TestBucketFixedVectors(t *testing.T) {
	for _, tc := range []struct {
		seed, user string
		want       int
	}{{"seed", "alice", 6647}, {"seed", "bob", 976}, {"固定种子", "用户甲", 5568}} {
		if got := Bucket(tc.seed, tc.user); got != tc.want {
			t.Errorf("%q/%q got %d want %d", tc.seed, tc.user, got, tc.want)
		}
	}
}
func TestPercentageEvaluation(t *testing.T) {
	for _, tc := range []struct {
		name, attrs    string
		bp             int
		want           bool
		status, source string
	}{
		{"zero", `{"user_id":"bob"}`, 0, false, "miss", "default"}, {"all", `{"user_id":"alice"}`, 10000, true, "hit", "percentage_rule"}, {"threshold low", `{"user_id":"bob"}`, 2500, true, "hit", "percentage_rule"}, {"threshold high", `{"user_id":"alice"}`, 2500, false, "miss", "default"}, {"equal threshold", `{"user_id":"bob"}`, 976, false, "miss", "default"}, {"next threshold", `{"user_id":"bob"}`, 977, true, "hit", "percentage_rule"}, {"missing", `{}`, 10000, false, "missing", "default"}, {"null", `{"user_id":null}`, 10000, false, "invalid_identifier", "default"}, {"number", `{"user_id":1}`, 10000, false, "invalid_identifier", "default"}, {"empty", `{"user_id":""}`, 10000, false, "invalid_identifier", "default"},
	} {
		t.Run(tc.name, func(t *testing.T) {
			s := fixture()
			s.Rules = []Rule{pct("p", 1, tc.bp, true)}
			got, err := Evaluate(s, json.RawMessage(tc.attrs))
			if err != nil || got.Value != tc.want || got.Source != tc.source || len(got.Trace) != 1 || got.Trace[0].Status != tc.status {
				t.Fatalf("%+v %v", got, err)
			}
		})
	}
}
func TestMixedRulesAndExpansion(t *testing.T) {
	s := fixture()
	s.Rules = []Rule{pct("p", 1, 10000, false), {ID: "a", Priority: 2, Attribute: "country", Operator: "equals", Expected: json.RawMessage(`"cn"`), Result: true}}
	got, err := Evaluate(s, json.RawMessage(`{"country":"cn","user_id":"alice"}`))
	if err != nil || got.Value || got.Source != "percentage_rule" || got.Trace[1].Status != "skipped" {
		t.Fatalf("first false %+v %v", got, err)
	}
	s.Rules[0].Priority = 3
	got, err = Evaluate(s, json.RawMessage(`{"country":"cn","user_id":"alice"}`))
	if err != nil || !got.Value || got.Source != "attribute_rule" || got.Trace[1].Status != "skipped" {
		t.Fatalf("attribute first %+v %v", got, err)
	}
	for _, user := range []string{"alice", "bob", "carol", "dave", "erin", "frank"} {
		small := fixture()
		small.Rules = []Rule{pct("p", 1, 2500, true)}
		large := fixture()
		large.Environment = "staging"
		large.Key = "renamed"
		large.Rules = []Rule{pct("p", 1, 7500, true)}
		raw, marshalErr := json.Marshal(map[string]string{"user_id": user})
		if marshalErr != nil {
			t.Fatal(marshalErr)
		}
		a, err := Evaluate(small, raw)
		if err != nil {
			t.Fatal(err)
		}
		repeat, err := Evaluate(small, raw)
		if err != nil || a.Value != repeat.Value {
			t.Fatal("unstable bucket")
		}
		b, err := Evaluate(large, raw)
		if err != nil || a.Value && !b.Value {
			t.Fatal("expansion lost user")
		}
	}
}
func TestPercentageShapeAndOwnership(t *testing.T) {
	for _, bp := range []int{-1, 10001} {
		s := fixture()
		s.Rules = []Rule{pct("p", 1, bp, true)}
		if _, err := Restore(s); !errors.Is(err, ErrInvalid) {
			t.Fatalf("accepted %d", bp)
		}
	}
	r := pct("p", 1, 10, true)
	r.Attribute = "invalid"
	s := fixture()
	s.Rules = []Rule{r}
	if _, err := Restore(s); !errors.Is(err, ErrInvalid) {
		t.Fatal("mixed shape accepted")
	}
	r = pct("p", 1, 10, true)
	s.Rules = []Rule{r}
	f, err := Restore(s)
	if err != nil {
		t.Fatal(err)
	}
	*r.PercentageBP = 100
	out := f.Snapshot()
	*out.Rules[0].PercentageBP = 200
	if *f.Snapshot().Rules[0].PercentageBP != 10 {
		t.Fatal("percentage pointer escaped")
	}
}
