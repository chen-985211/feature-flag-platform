package domain

func CanWrite(role, environment string) bool {
	if environment != "development" && environment != "staging" && environment != "production" {
		return false
	}
	return role == "admin" || role == "editor" && environment != "production"
}
