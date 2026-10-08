package application

import (
	"context"
	"didi/backend/internal/contexts/flags/domain"
	"encoding/json"
	"errors"
	"time"
)

var ErrNotFound = errors.New("FLAG_NOT_FOUND")
var ErrConflict = errors.New("VERSION_CONFLICT")
var ErrKeyConflict = errors.New("FLAG_KEY_CONFLICT")
var ErrForbidden = errors.New("FORBIDDEN")

type Actor struct{ ID, Name, Role string }
type Change struct {
	Action    string
	Before    *domain.Snapshot
	After     domain.Snapshot
	Actor     Actor
	RequestID string
}
type AuditPort interface {
	Append(context.Context, Change) error
}
type Scope interface {
	Load(context.Context, string) (domain.Snapshot, error)
	Save(context.Context, domain.Snapshot, Actor) error
	Audit() AuditPort
}
type Filter struct {
	Environment, Query string
	Enabled            *bool
	Limit, Offset      int
}
type Page struct {
	Items []domain.Snapshot
	Total int
}
type Store interface {
	Within(context.Context, func(Scope) error) error
	Get(context.Context, string) (domain.Snapshot, error)
	ByKey(context.Context, string, string) (domain.Snapshot, error)
	List(context.Context, Filter) (Page, error)
}
type Command struct {
	Action, ID, RuleID, Name, Key, Environment string
	Enabled, DefaultValue                      bool
	ExpectedRevision                           int64
	Rule                                       domain.Rule
}
type Service struct {
	Store     Store
	Authorize func(Actor, string) bool
	NewID     func() string
	Now       func() time.Time
}

func (s Service) Execute(ctx context.Context, actor Actor, requestID string, cmd Command) (domain.Snapshot, error) {
	var result domain.Snapshot
	if actor.ID == "" || actor.Name == "" || requestID == "" {
		return result, ErrForbidden
	}
	err := s.Store.Within(ctx, func(tx Scope) error {
		var before *domain.Snapshot
		var f *domain.Flag
		var err error
		if cmd.Action == "flag_created" {
			if !s.Authorize(actor, cmd.Environment) {
				return ErrForbidden
			}
			now := s.Now()
			f, err = domain.Restore(domain.Snapshot{SchemaVersion: 1, ID: s.NewID(), Name: cmd.Name, Key: cmd.Key, Environment: cmd.Environment, Seed: s.NewID(), Enabled: cmd.Enabled, DefaultValue: cmd.DefaultValue, Revision: 1, Rules: []domain.Rule{}, CreatedAt: now, UpdatedAt: now})
		} else {
			current, loadErr := tx.Load(ctx, cmd.ID)
			if loadErr != nil {
				return loadErr
			}
			if !s.Authorize(actor, current.Environment) {
				return ErrForbidden
			}
			if current.Revision != cmd.ExpectedRevision {
				return ErrConflict
			}
			before = &current
			f, err = domain.Restore(current)
		}
		if err != nil {
			return err
		}
		switch cmd.Action {
		case "flag_created":
		case "flag_edited":
			err = f.Edit(cmd.Name, cmd.Key, cmd.DefaultValue)
		case "flag_enabled":
			f.SetEnabled(cmd.Enabled)
		case "rule_created":
			r := cmd.Rule
			r.ID = s.NewID()
			err = f.AddRule(r)
		case "rule_edited":
			r := cmd.Rule
			r.ID = cmd.RuleID
			err = f.UpdateRule(r)
		case "rule_deleted":
			err = f.DeleteRule(cmd.RuleID)
		default:
			return domain.ErrInvalid
		}
		if err != nil {
			return err
		}
		if before != nil {
			if err = f.Advance(s.Now()); err != nil {
				return err
			}
		}
		result = f.Snapshot()
		if _, err = domain.Restore(result); err != nil {
			return err
		}
		if err = tx.Save(ctx, result, actor); err != nil {
			return err
		}
		return tx.Audit().Append(ctx, Change{Action: cmd.Action, Before: before, After: result, Actor: actor, RequestID: requestID})
	})
	if err != nil {
		return domain.Snapshot{}, err
	}
	return result, nil
}
func (s Service) Evaluate(ctx context.Context, environment, key string, attrs json.RawMessage) (domain.Evaluation, error) {
	if !domain.ValidEnvironment(environment) || key == "" {
		return domain.Evaluation{}, domain.ErrInvalid
	}
	snapshot, err := s.Store.ByKey(ctx, environment, key)
	if err != nil {
		return domain.Evaluation{}, err
	}
	return domain.Evaluate(snapshot, attrs)
}
