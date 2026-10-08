package application

import (
	"context"
	"encoding/json"
	"errors"
	"time"
)

type Entry struct {
	ID, FlagID, Environment, Key, ActorID, ActorName, Action, RequestID string
	Revision                                                            int64
	Changes                                                             json.RawMessage
	CreatedAt                                                           time.Time
}
type Appender interface {
	Insert(context.Context, Entry) error
}
type Reader interface {
	List(context.Context, string, int, int) ([]Entry, int, error)
}
type Service struct {
	Appender Appender
	Reader   Reader
}

func (s Service) Append(ctx context.Context, e Entry) error {
	var object map[string]json.RawMessage
	if e.ID == "" || e.FlagID == "" || e.Revision < 1 || e.ActorID == "" || e.ActorName == "" || e.Action == "" || e.RequestID == "" || len(e.Changes) > 65536 || json.Unmarshal(e.Changes, &object) != nil || object == nil {
		return errors.New("INVALID_AUDIT_ENTRY")
	}
	return s.Appender.Insert(ctx, e)
}
func (s Service) History(ctx context.Context, id string, limit, offset int) ([]Entry, int, error) {
	return s.Reader.List(ctx, id, limit, offset)
}
