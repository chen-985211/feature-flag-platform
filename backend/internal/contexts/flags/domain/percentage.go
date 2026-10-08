package domain

import (
	"crypto/sha256"
	"encoding/binary"
	"encoding/json"
)

func Bucket(seed, userID string) int {
	digest := sha256.Sum256([]byte(seed + "\x00" + userID))
	return int(binary.BigEndian.Uint64(digest[:8]) % 10000)
}
func percentageMatch(seed string, r Rule, attrs map[string]json.RawMessage) string {
	raw, ok := attrs["user_id"]
	if !ok {
		return "missing"
	}
	var userID string
	if json.Unmarshal(raw, &userID) != nil || userID == "" {
		return "invalid_identifier"
	}
	if Bucket(seed, userID) < *r.PercentageBP {
		return "hit"
	}
	return "miss"
}
