package infrastructure

import (
	"encoding/json"
	"fmt"
	"strings"
	"testing"
)

func TestD2SnapshotNearSizeLimitRemainsReadableAndWritable(t *testing.T) {
	rules := []map[string]any{}
	for i := 1; i <= 100; i++ {
		rules = append(rules, map[string]any{"ID": fmt.Sprintf("00000000-0000-4000-8000-%012d", i), "Priority": i, "Attribute": "a", "Operator": "equals", "ExpectedJSON": `"` + strings.Repeat("x", 82) + `"`, "Result": true})
	}
	legacy := map[string]any{"SchemaVersion": 1, "ID": "00000000-0000-4000-8000-000000000101", "Name": "Legacy", "Key": "legacy", "Environment": "development", "Seed": "00000000-0000-4000-8000-000000000102", "Enabled": true, "DefaultValue": false, "Revision": 1, "Rules": rules, "CreatedAt": "2026-10-08T00:00:00Z", "UpdatedAt": "2026-10-08T00:00:00Z"}
	raw, err := json.Marshal(legacy)
	if err != nil {
		t.Fatal(err)
	}
	if len(raw) > 24<<10 {
		t.Fatalf("invalid old fixture size %d", len(raw))
	}
	s, err := decodeSnapshot(raw)
	if err != nil {
		t.Fatalf("old valid snapshot (%d bytes) unreadable: %v", len(raw), err)
	}
	encoded, err := encodeSnapshot(s)
	if err != nil || len(encoded) > 24<<10 {
		t.Fatalf("old valid snapshot became unwritable: %v", err)
	}
}
