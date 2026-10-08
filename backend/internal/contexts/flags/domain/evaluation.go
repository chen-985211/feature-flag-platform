package domain

import (
	"bytes"
	"encoding/json"
	"math/big"
	"strconv"
	"strings"
)

// Numeric limits bound rational allocation while preserving exact JSON numbers.
func scalar(raw json.RawMessage) (string, string, error) {
	d := json.NewDecoder(bytes.NewReader(raw))
	d.UseNumber()
	var value any
	if !json.Valid(raw) || d.Decode(&value) != nil {
		return "", "", ErrInvalid
	}
	switch v := value.(type) {
	case string:
		return "string", v, nil
	case bool:
		return "boolean", strconv.FormatBool(v), nil
	case json.Number:
		s := v.String()
		if len(s) > 256 {
			return "", "", ErrInvalid
		}
		if p := strings.IndexAny(s, "eE"); p >= 0 {
			exp, err := strconv.Atoi(s[p+1:])
			if err != nil || exp > 1000 || exp < -1000 {
				return "", "", ErrInvalid
			}
		}
		n, ok := new(big.Rat).SetString(s)
		if !ok {
			return "", "", ErrInvalid
		}
		return "number", n.RatString(), nil
	default:
		return "", "", ErrInvalid
	}
}
func expectedValues(r Rule) ([]json.RawMessage, error) {
	if r.Operator == "equals" {
		if _, _, err := scalar(r.Expected); err != nil {
			return nil, err
		}
		return []json.RawMessage{r.Expected}, nil
	}
	if r.Operator != "in" {
		return nil, ErrInvalid
	}
	var values []json.RawMessage
	if json.Unmarshal(r.Expected, &values) != nil || len(values) == 0 || len(values) > 100 {
		return nil, ErrInvalid
	}
	kind := ""
	for _, v := range values {
		k, _, err := scalar(v)
		if err != nil || kind != "" && kind != k {
			return nil, ErrInvalid
		}
		kind = k
	}
	return values, nil
}
func Evaluate(s Snapshot, raw json.RawMessage) (Evaluation, error) {
	var attrs map[string]json.RawMessage
	if !json.Valid(raw) || json.Unmarshal(raw, &attrs) != nil || attrs == nil {
		return Evaluation{}, ErrInvalid
	}
	// Validate numeric bounds throughout input, including unused attributes.
	var value any
	d := json.NewDecoder(bytes.NewReader(raw))
	d.UseNumber()
	if d.Decode(&value) != nil || validateNumbers(value) != nil {
		return Evaluation{}, ErrInvalid
	}
	f, err := Restore(s)
	if err != nil {
		return Evaluation{}, err
	}
	s = f.Snapshot()
	out := Evaluation{Revision: s.Revision, Source: "default", Value: s.DefaultValue, UsedDefault: true, Trace: []Trace{}}
	if !s.Enabled {
		out.Value = false
		out.Source = "disabled"
		out.UsedDefault = false
		for _, r := range s.Rules {
			out.Trace = append(out.Trace, Trace{RuleID: r.ID, Status: "skipped"})
		}
		return out, nil
	}
	for _, r := range s.Rules {
		status := "miss"
		if out.MatchedRuleID != nil {
			status = "skipped"
		} else if actual, ok := attrs[r.Attribute]; !ok {
			status = "missing"
		} else {
			k, v, actualErr := scalar(actual)
			candidates, expectedErr := expectedValues(r)
			if expectedErr != nil {
				return Evaluation{}, expectedErr
			}
			if actualErr == nil {
				for _, candidate := range candidates {
					ck, cv, candidateErr := scalar(candidate)
					if candidateErr != nil {
						return Evaluation{}, candidateErr
					}
					if k == ck && v == cv {
						status = "hit"
						out.Value = r.Result
						out.Source = "attribute_rule"
						out.UsedDefault = false
						id := r.ID
						out.MatchedRuleID = &id
						break
					}
				}
			}
		}
		out.Trace = append(out.Trace, Trace{RuleID: r.ID, Status: status})
	}
	return out, nil
}
func validateNumbers(value any) error {
	switch v := value.(type) {
	case json.Number:
		_, _, err := scalar(json.RawMessage(v.String()))
		return err
	case map[string]any:
		for _, item := range v {
			if err := validateNumbers(item); err != nil {
				return err
			}
		}
	case []any:
		for _, item := range v {
			if err := validateNumbers(item); err != nil {
				return err
			}
		}
	}
	return nil
}
