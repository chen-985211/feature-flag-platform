package infrastructure

import (
	"didi/backend/internal/contexts/flags/domain"
	"encoding/json"
	"time"
)

type RuleDTO struct {
	PercentageBP *int            `json:"percentage_bp,omitempty"`
	ExpectedJSON string          `json:"expected_json"`
	ID           string          `json:"id"`
	Priority     int             `json:"priority"`
	Kind         string          `json:"kind"`
	Attribute    string          `json:"attribute"`
	Operator     string          `json:"operator"`
	Expected     json.RawMessage `json:"expected"`
	Result       bool            `json:"result"`
}
type SnapshotDTO struct {
	ID           string    `json:"id"`
	Name         string    `json:"name"`
	Key          string    `json:"key"`
	Environment  string    `json:"environment"`
	Enabled      bool      `json:"enabled"`
	DefaultValue bool      `json:"default_value"`
	Seed         string    `json:"seed"`
	Revision     int64     `json:"revision"`
	Rules        []RuleDTO `json:"rules"`
	CreatedAt    time.Time `json:"created_at"`
	UpdatedAt    time.Time `json:"updated_at"`
}

func snapshotDTO(s domain.Snapshot) SnapshotDTO {
	out := SnapshotDTO{ID: s.ID, Name: s.Name, Key: s.Key, Environment: s.Environment, Enabled: s.Enabled, DefaultValue: s.DefaultValue, Seed: s.Seed, Revision: s.Revision, Rules: []RuleDTO{}, CreatedAt: s.CreatedAt, UpdatedAt: s.UpdatedAt}
	for _, r := range s.Rules {
		out.Rules = append(out.Rules, RuleDTO{ID: r.ID, Priority: r.Priority, Kind: r.Kind, PercentageBP: r.PercentageBP, Attribute: r.Attribute, Operator: r.Operator, Expected: r.Expected, ExpectedJSON: string(r.Expected), Result: r.Result})
	}
	return out
}

type traceDTO struct {
	RuleID string `json:"rule_id"`
	Status string `json:"status"`
}
type evaluationDTO struct {
	Value         bool       `json:"value"`
	Revision      int64      `json:"revision"`
	Source        string     `json:"source"`
	MatchedRuleID *string    `json:"matched_rule_id"`
	UsedDefault   bool       `json:"used_default"`
	Trace         []traceDTO `json:"trace"`
}

func resultDTO(e domain.Evaluation) evaluationDTO {
	out := evaluationDTO{Value: e.Value, Revision: e.Revision, Source: e.Source, MatchedRuleID: e.MatchedRuleID, UsedDefault: e.UsedDefault, Trace: []traceDTO{}}
	for _, step := range e.Trace {
		out.Trace = append(out.Trace, traceDTO{RuleID: step.RuleID, Status: step.Status})
	}
	return out
}
