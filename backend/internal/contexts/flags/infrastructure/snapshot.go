package infrastructure

import (
	"didi/backend/internal/contexts/flags/domain"
	"encoding/json"
)

// Store expected JSON as text: JSONB otherwise expands/normalizes number lexemes.
// This codec is also used for audit changes; it contains configuration facts only.
type storedRule struct {
	Kind                              string `json:",omitempty"`
	PercentageBP                      *int   `json:",omitempty"`
	ID                                string
	Priority                          int
	Attribute, Operator, ExpectedJSON string
	Result                            bool
}
type storedSnapshot struct {
	domain.Snapshot
	Rules []storedRule
}

func stored(s domain.Snapshot) storedSnapshot {
	out := storedSnapshot{Snapshot: s, Rules: []storedRule{}}
	for _, r := range s.Rules {
		kind := r.Kind
		if kind == "attribute" {
			kind = ""
		}
		out.Rules = append(out.Rules, storedRule{Kind: kind, PercentageBP: r.PercentageBP, ID: r.ID, Priority: r.Priority, Attribute: r.Attribute, Operator: r.Operator, ExpectedJSON: string(r.Expected), Result: r.Result})
	}
	return out
}
func encodeSnapshot(s domain.Snapshot) ([]byte, error) {
	raw, err := json.Marshal(stored(s))
	if err != nil {
		return nil, err
	}
	if len(raw) > 24<<10 {
		return nil, domain.ErrInvalid
	}
	return raw, nil
}
func decodeSnapshot(raw []byte) (domain.Snapshot, error) {
	var saved storedSnapshot
	if err := json.Unmarshal(raw, &saved); err != nil {
		return domain.Snapshot{}, err
	}
	s := saved.Snapshot
	s.Rules = []domain.Rule{}
	for _, r := range saved.Rules {
		s.Rules = append(s.Rules, domain.Rule{Kind: r.Kind, PercentageBP: r.PercentageBP, ID: r.ID, Priority: r.Priority, Attribute: r.Attribute, Operator: r.Operator, Expected: json.RawMessage(r.ExpectedJSON), Result: r.Result})
	}
	f, err := domain.Restore(s)
	if err != nil {
		return domain.Snapshot{}, err
	}
	return f.Snapshot(), nil
}
