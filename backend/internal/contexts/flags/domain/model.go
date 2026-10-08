package domain

import (
	"encoding/json"
	"errors"
	"slices"
	"strings"
	"time"
	"unicode/utf8"
)

var ErrInvalid = errors.New("INVALID_INPUT")
var ErrPriority = errors.New("PRIORITY_CONFLICT")
var ErrRuleNotFound = errors.New("RULE_NOT_FOUND")

type Rule struct {
	Kind                string `json:",omitempty"`
	PercentageBP        *int   `json:",omitempty"`
	ID                  string
	Priority            int
	Attribute, Operator string
	Expected            json.RawMessage
	Result              bool
}
type Snapshot struct {
	SchemaVersion                    int
	ID, Name, Key, Environment, Seed string
	Enabled, DefaultValue            bool
	Revision                         int64
	Rules                            []Rule
	CreatedAt, UpdatedAt             time.Time
}
type Trace struct{ RuleID, Status string }
type Evaluation struct {
	Value         bool
	Revision      int64
	Source        string
	MatchedRuleID *string
	UsedDefault   bool
	Trace         []Trace
}
type Flag struct{ state Snapshot }

func ValidEnvironment(env string) bool {
	return env == "development" || env == "staging" || env == "production"
}
func textValid(s string, max int) bool {
	return strings.TrimSpace(s) == s && utf8.RuneCountInString(s) > 0 && utf8.RuneCountInString(s) <= max && !strings.ContainsRune(s, 0)
}
func Restore(s Snapshot) (*Flag, error) {
	if s.SchemaVersion != 1 || s.ID == "" || s.Seed == "" || !textValid(s.Name, 160) || !textValid(s.Key, 128) || !ValidEnvironment(s.Environment) || s.Revision < 1 || s.Revision > 9007199254740991 || len(s.Rules) > 100 {
		return nil, ErrInvalid
	}
	f := &Flag{state: s}
	f.state.Rules = []Rule{}
	for _, r := range s.Rules {
		if err := f.AddRule(r); err != nil {
			return nil, err
		}
	}
	sizing := f.Snapshot()
	for i := range sizing.Rules {
		if sizing.Rules[i].Kind == "attribute" {
			sizing.Rules[i].Kind = ""
		}
	}
	raw, err := json.Marshal(sizing)
	if err != nil || len(raw) > 24<<10 {
		return nil, ErrInvalid
	}
	return f, nil
}
func (f *Flag) Snapshot() Snapshot {
	s := f.state
	s.Rules = slices.Clone(s.Rules)
	for i := range s.Rules {
		s.Rules[i] = cloneRule(s.Rules[i])
	}
	slices.SortFunc(s.Rules, func(a, b Rule) int { return a.Priority - b.Priority })
	return s
}
func (f *Flag) Edit(name, key string, defaultValue bool) error {
	if !textValid(name, 160) || !textValid(key, 128) {
		return ErrInvalid
	}
	f.state.Name = name
	f.state.Key = key
	f.state.DefaultValue = defaultValue
	return nil
}
func (f *Flag) SetEnabled(enabled bool) { f.state.Enabled = enabled }
func (f *Flag) Advance(now time.Time) error {
	if f.state.Revision >= 9007199254740991 {
		return ErrInvalid
	}
	f.state.Revision++
	f.state.UpdatedAt = now
	return nil
}
func (f *Flag) AddRule(r Rule) error {
	if r.Kind == "" {
		r.Kind = "attribute"
	}
	if len(f.state.Rules) >= 100 {
		return ErrInvalid
	}
	if err := validRule(r); err != nil {
		return err
	}
	for _, existing := range f.state.Rules {
		if existing.Priority == r.Priority {
			return ErrPriority
		}
		if existing.ID == r.ID {
			return ErrInvalid
		}
	}
	r = cloneRule(r)
	f.state.Rules = append(f.state.Rules, r)
	return nil
}
func (f *Flag) UpdateRule(r Rule) error {
	if r.Kind == "" {
		r.Kind = "attribute"
	}
	if err := validRule(r); err != nil {
		return err
	}
	index := -1
	for i, existing := range f.state.Rules {
		if existing.ID == r.ID {
			index = i
		} else if existing.Priority == r.Priority {
			return ErrPriority
		}
	}
	if index < 0 {
		return ErrRuleNotFound
	}
	r = cloneRule(r)
	f.state.Rules[index] = r
	return nil
}
func (f *Flag) DeleteRule(id string) error {
	for i, r := range f.state.Rules {
		if r.ID == id {
			f.state.Rules = slices.Delete(f.state.Rules, i, i+1)
			return nil
		}
	}
	return ErrRuleNotFound
}
func validRule(r Rule) error {
	if r.ID == "" || r.Priority < 1 || r.Priority > 2147483647 {
		return ErrInvalid
	}
	if r.Kind == "percentage" {
		if r.PercentageBP == nil || *r.PercentageBP < 0 || *r.PercentageBP > 10000 || r.Attribute != "" || r.Operator != "" || len(r.Expected) != 0 {
			return ErrInvalid
		}
		return nil
	}
	if r.Kind != "attribute" || r.PercentageBP != nil || utf8.RuneCountInString(r.Attribute) < 1 || utf8.RuneCountInString(r.Attribute) > 128 || strings.TrimSpace(r.Attribute) == "" || strings.ContainsRune(r.Attribute, 0) {
		return ErrInvalid
	}
	_, err := expectedValues(r)
	return err
}
func cloneRule(r Rule) Rule {
	r.Expected = slices.Clone(r.Expected)
	if r.Kind == "percentage" {
		r.Expected = nil
	}
	if r.PercentageBP != nil {
		bp := *r.PercentageBP
		r.PercentageBP = &bp
	}
	return r
}
