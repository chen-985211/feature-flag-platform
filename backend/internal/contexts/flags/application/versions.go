package application

import (
	"context"
	"didi/backend/internal/contexts/flags/domain"
	"time"
)

type VersionSummary struct {
	Revision           int64
	SchemaVersion      int
	ActorID, ActorName string
	CreatedAt          time.Time
}
type Version struct {
	VersionSummary
	Snapshot domain.Snapshot
}
type VersionsPage struct {
	Items []VersionSummary
	Total int
}
type Preview struct {
	CurrentRevision, SourceRevision int64
	Source                          domain.Snapshot
	Changes                         []domain.Difference
}

func (s Service) Versions(ctx context.Context, id string, limit, offset int) (VersionsPage, error) {
	if _, err := s.Store.Get(ctx, id); err != nil {
		return VersionsPage{}, err
	}
	return s.Store.Versions(ctx, id, limit, offset)
}
func (s Service) Version(ctx context.Context, id string, revision int64) (Version, error) {
	if _, err := s.Store.Get(ctx, id); err != nil {
		return Version{}, err
	}
	return s.Store.Version(ctx, id, revision)
}
func (s Service) Preview(ctx context.Context, id string, revision int64) (Preview, error) {
	current, err := s.Store.Get(ctx, id)
	if err != nil {
		return Preview{}, err
	}
	source, err := s.Store.Version(ctx, id, revision)
	if err != nil {
		return Preview{}, err
	}
	changes, err := domain.Differences(current, source.Snapshot)
	if err != nil {
		return Preview{}, err
	}
	return Preview{CurrentRevision: current.Revision, SourceRevision: revision, Source: source.Snapshot, Changes: changes}, nil
}
