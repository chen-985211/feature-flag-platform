package application

import (
	"context"
	"didi/backend/internal/contexts/flags/domain"
	"errors"
)

var ErrTargetNotFound = errors.New("TARGET_NOT_FOUND")

type Publication struct {
	Source, Target                 domain.Snapshot
	SourceRevision, TargetRevision int64
	Changes                        []domain.Difference
}

func validRevision(revision int64) bool { return revision >= 1 && revision <= 9007199254740991 }
func sourceOf(snapshot domain.Snapshot) *Source {
	return &Source{FlagID: snapshot.ID, Environment: snapshot.Environment, Revision: snapshot.Revision}
}
func (s Service) fixedSource(ctx context.Context, tx Scope, cmd Command) (domain.Snapshot, error) {
	if !validRevision(cmd.SourceRevision) {
		return domain.Snapshot{}, domain.ErrInvalid
	}
	return tx.Version(ctx, cmd.SourceID, cmd.SourceRevision)
}
func (s Service) ruleIDs(n int) []string {
	ids := make([]string, n)
	for i := range ids {
		ids[i] = s.NewID()
	}
	return ids
}
func (s Service) PublicationPreview(ctx context.Context, id string, revision int64, environment string) (Publication, error) {
	if !validRevision(revision) || !domain.ValidEnvironment(environment) {
		return Publication{}, domain.ErrInvalid
	}
	source, err := s.Store.Version(ctx, id, revision)
	if err != nil {
		return Publication{}, err
	}
	if source.Snapshot.Environment == environment {
		return Publication{}, domain.ErrInvalid
	}
	target, err := s.Store.ByKey(ctx, environment, source.Snapshot.Key)
	if errors.Is(err, ErrNotFound) {
		return Publication{}, ErrTargetNotFound
	}
	if err != nil {
		return Publication{}, err
	}
	changes, err := domain.PublicationDifferences(target, source.Snapshot)
	if err != nil {
		return Publication{}, err
	}
	return Publication{Source: source.Snapshot, Target: target, SourceRevision: revision, TargetRevision: target.Revision, Changes: changes}, nil
}
