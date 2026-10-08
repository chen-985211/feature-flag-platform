package public

import "didi/backend/internal/contexts/identity/application"

func CanWrite(role, environment string) bool {
	for _, env := range application.Capabilities(role) {
		if env == environment {
			return true
		}
	}
	return false
}
