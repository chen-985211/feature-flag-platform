package domain

func (f *Flag) Reorder(ids []string) error {
	if len(ids) != len(f.state.Rules) {
		return ErrInvalid
	}
	remaining := make(map[string]Rule, len(f.state.Rules))
	for _, r := range f.state.Rules {
		remaining[r.ID] = r
	}
	ordered := make([]Rule, 0, len(ids))
	for i, id := range ids {
		r, ok := remaining[id]
		if !ok {
			return ErrInvalid
		}
		delete(remaining, id)
		r.Priority = i + 1
		ordered = append(ordered, r)
	}
	f.state.Rules = ordered
	return nil
}
