package application

import (
	"context"
	"didi/backend/internal/contexts/flags/domain"
	"testing"
	"time"
)

func TestRollbackAndBoundPreview(t *testing.T) {
	f := &fakeStore{state: domain.Snapshot{SchemaVersion: 1, ID: "id", Environment: "development", Name: "Now", Key: "now", Seed: "now-seed", Revision: 8, CreatedAt: time.Unix(20, 0)}}
	service := Service{Store: f, Authorize: func(Actor, string) bool { return true }, Now: func() time.Time { return time.Unix(100, 0) }, NewID: func() string { return "id" }}
	preview, err := service.Preview(context.Background(), "id", 1)
	if err != nil || preview.CurrentRevision != 8 || preview.SourceRevision != 1 || preview.Source.Name != "Historical" || len(preview.Changes) != 5 {
		t.Fatalf("preview %+v %v", preview, err)
	}
	s, err := service.Execute(context.Background(), Actor{ID: "actor", Name: "Actor"}, "request", Command{Action: "flag_rolled_back", ID: "id", ExpectedRevision: 8, SourceRevision: 1})
	if err != nil || s.Revision != 9 || s.Name != "Historical" || !s.Enabled || !s.DefaultValue || s.Seed != "old-seed" || !s.CreatedAt.Equal(time.Unix(20, 0)) || f.saved != 1 || f.appended != 1 {
		t.Fatalf("rollback %+v %v", s, err)
	}
}
