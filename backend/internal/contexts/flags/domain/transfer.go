package domain

import (
	"encoding/json"
	"strconv"
	"time"
)

func CopyConfiguration(source Snapshot, id, environment string, ruleIDs []string, now time.Time) (Snapshot, error) {
	f, err := Restore(source)
	if err != nil {
		return Snapshot{}, err
	}
	source = f.Snapshot()
	if id == "" || id == source.ID || !ValidEnvironment(environment) || environment == source.Environment {
		return Snapshot{}, ErrInvalid
	}
	rules, err := transferRules(source.Rules, ruleIDs)
	if err != nil {
		return Snapshot{}, err
	}
	source.ID = id
	source.Environment = environment
	source.Revision = 1
	source.CreatedAt = now
	source.UpdatedAt = now
	source.Rules = rules
	copied, err := Restore(source)
	if err != nil {
		return Snapshot{}, err
	}
	return copied.Snapshot(), nil
}
func (f *Flag) Publish(source Snapshot, ruleIDs []string) error {
	if !publicationTarget(f.state, source) {
		return ErrInvalid
	}
	historical, err := Restore(source)
	if err != nil {
		return err
	}
	source = historical.Snapshot()
	rules, err := transferRules(source.Rules, ruleIDs)
	if err != nil {
		return err
	}
	next := f.Snapshot()
	next.Name = source.Name
	next.Enabled = source.Enabled
	next.DefaultValue = source.DefaultValue
	next.Seed = source.Seed
	next.Rules = rules
	validated, err := Restore(next)
	if err != nil {
		return err
	}
	f.state = validated.Snapshot()
	return nil
}
func publicationTarget(target, source Snapshot) bool {
	return target.ID != source.ID && target.Environment != source.Environment && target.Key == source.Key
}
func transferRules(source []Rule, ids []string) ([]Rule, error) {
	if len(source) != len(ids) {
		return nil, ErrInvalid
	}
	used := map[string]bool{}
	for _, r := range source {
		used[r.ID] = true
	}
	rules := make([]Rule, 0, len(ids))
	for i, id := range ids {
		if id == "" || used[id] {
			return nil, ErrInvalid
		}
		used[id] = true
		r := cloneRule(source[i])
		r.ID = id
		rules = append(rules, r)
	}
	return rules, nil
}
func PublicationDifferences(target, source Snapshot) ([]Difference, error) {
	if !publicationTarget(target, source) {
		return nil, ErrInvalid
	}
	changes, err := Differences(target, source)
	if err != nil {
		return nil, err
	}
	// Rule identities belong to different aggregates. Compare their content in
	// order while retaining the original JSON in the display payload.
	comparable := func(rules []Rule) (string, error) {
		out := make([]Rule, 0, len(rules))
		for i, r := range rules {
			r = cloneRule(r)
			r.ID = strconv.Itoa(i + 1)
			out = append(out, r)
		}
		raw, err := json.Marshal(out)
		return string(raw), err
	}
	a, err := Restore(target)
	if err != nil {
		return nil, err
	}
	b, err := Restore(source)
	if err != nil {
		return nil, err
	}
	old, err := comparable(a.Snapshot().Rules)
	if err != nil {
		return nil, err
	}
	next, err := comparable(b.Snapshot().Rules)
	if err != nil {
		return nil, err
	}
	out := []Difference{}
	for _, c := range changes {
		if c.Field != "rules" || old != next {
			out = append(out, c)
		}
	}
	return out, nil
}
