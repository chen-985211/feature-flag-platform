package public

import (
	"context"
	"didi/backend/internal/contexts/audit/application"
)

type Entry = application.Entry
type Service struct{ UseCases application.Service }

func (s Service) Append(ctx context.Context, e Entry) error { return s.UseCases.Append(ctx, e) }
func (s Service) History(ctx context.Context, id string, limit, offset int) ([]Entry, int, error) {
	return s.UseCases.History(ctx, id, limit, offset)
}
