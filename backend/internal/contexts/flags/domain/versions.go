package domain

import "encoding/json"

type Difference struct{ Field, BeforeJSON, AfterJSON string }

func Differences(before, after Snapshot) ([]Difference, error) {
	a, err := Restore(before)
	if err != nil {
		return nil, err
	}
	b, err := Restore(after)
	if err != nil {
		return nil, err
	}
	before = a.Snapshot()
	after = b.Snapshot()
	changes := []Difference{}
	fields := []struct {
		name string
		a, b any
	}{{"name", before.Name, after.Name}, {"key", before.Key, after.Key}, {"enabled", before.Enabled, after.Enabled}, {"default_value", before.DefaultValue, after.DefaultValue}, {"seed", before.Seed, after.Seed}, {"rules", before.Rules, after.Rules}}
	for _, field := range fields {
		old, err := json.Marshal(field.a)
		if err != nil {
			return nil, err
		}
		next, err := json.Marshal(field.b)
		if err != nil {
			return nil, err
		}
		if string(old) != string(next) {
			changes = append(changes, Difference{Field: field.name, BeforeJSON: string(old), AfterJSON: string(next)})
		}
	}
	return changes, nil
}
func (f *Flag) ApplyVersion(source Snapshot) error {
	if source.ID != f.state.ID || source.Environment != f.state.Environment {
		return ErrInvalid
	}
	historical, err := Restore(source)
	if err != nil {
		return err
	}
	content := historical.Snapshot()
	f.state.Name = content.Name
	f.state.Key = content.Key
	f.state.Enabled = content.Enabled
	f.state.DefaultValue = content.DefaultValue
	f.state.Seed = content.Seed
	f.state.Rules = content.Rules
	return nil
}
