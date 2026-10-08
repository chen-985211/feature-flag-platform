package domain

import "testing"

func TestWritePolicy(t *testing.T) {
	for _, role := range []string{"admin", "editor", "viewer", "forged"} {
		for _, env := range []string{"development", "staging", "production", "unknown"} {
			want := (role == "admin" || role == "editor" && env != "production") && env != "unknown"
			if got := CanWrite(role, env); got != want {
				t.Errorf("%s/%s: got %v want %v", role, env, got, want)
			}
		}
	}
}
