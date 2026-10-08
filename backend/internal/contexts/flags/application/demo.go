package application

import (
	"context"
	"didi/backend/internal/contexts/flags/domain"
	"encoding/json"
	"time"
)

type DemoResult struct{ Created, Preserved int }

// InitializeDemo creates complete initial aggregates; existing IDs are preserved.
func (s Service) InitializeDemo(ctx context.Context, actor Actor, requestID string) (DemoResult, error) {
	if actor.ID == "" || actor.Name == "" || requestID == "" {
		return DemoResult{}, ErrForbidden
	}
	snapshots := demoConfigurations(s.Now())
	for _, snapshot := range snapshots {
		if !s.Authorize(actor, snapshot.Environment) {
			return DemoResult{}, ErrForbidden
		}
	}
	var result DemoResult
	err := s.Store.Within(ctx, func(tx Scope) error {
		for _, snapshot := range snapshots {
			flag, err := domain.Restore(snapshot)
			if err != nil {
				return err
			}
			snapshot = flag.Snapshot()
			created, err := tx.Create(ctx, snapshot, actor)
			if err != nil {
				return err
			}
			if !created {
				result.Preserved++
				continue
			}
			if err := tx.Audit().Append(ctx, Change{Action: "flag_created", After: snapshot, Actor: actor, RequestID: requestID}); err != nil {
				return err
			}
			result.Created++
		}
		return nil
	})
	if err != nil {
		return DemoResult{}, err
	}
	return result, nil
}

func demoConfigurations(now time.Time) []domain.Snapshot {
	bp := 2500
	checkout := domain.Snapshot{SchemaVersion: 1, ID: "d5d50000-0000-4000-8000-000000000001", Name: "演示：结账灰度", Key: "demo-checkout", Environment: "development", Enabled: true, Seed: "d5d50000-0000-4000-8000-000000000901", Revision: 1, CreatedAt: now, UpdatedAt: now, Rules: []domain.Rule{
		{ID: "d5d50000-0000-4000-8000-000000000101", Priority: 1, Attribute: "tier", Operator: "equals", Expected: json.RawMessage(`"blocked"`), Result: false},
		{ID: "d5d50000-0000-4000-8000-000000000102", Priority: 2, Attribute: "country", Operator: "in", Expected: json.RawMessage(`["CN","SG"]`), Result: true},
		{ID: "d5d50000-0000-4000-8000-000000000103", Priority: 3, Kind: "percentage", PercentageBP: &bp, Result: true},
	}}
	staging := domain.Snapshot{SchemaVersion: 1, ID: "d5d50000-0000-4000-8000-000000000002", Name: "演示：结账预发布基线", Key: checkout.Key, Environment: "staging", Enabled: true, Seed: "d5d50000-0000-4000-8000-000000000902", Revision: 1, CreatedAt: now, UpdatedAt: now, Rules: []domain.Rule{{ID: "d5d50000-0000-4000-8000-000000000201", Priority: 1, Attribute: "country", Operator: "equals", Expected: json.RawMessage(`"CN"`), Result: false}}}
	production := domain.Snapshot{SchemaVersion: 1, ID: "d5d50000-0000-4000-8000-000000000003", Name: "演示：结账生产基线", Key: checkout.Key, Environment: "production", Enabled: true, Seed: "d5d50000-0000-4000-8000-000000000903", Revision: 1, CreatedAt: now, UpdatedAt: now, Rules: []domain.Rule{}}
	off := domain.Snapshot{SchemaVersion: 1, ID: "d5d50000-0000-4000-8000-000000000004", Name: "演示：停用优先", Key: "demo-off", Environment: "development", DefaultValue: true, Seed: "d5d50000-0000-4000-8000-000000000904", Revision: 1, CreatedAt: now, UpdatedAt: now, Rules: []domain.Rule{{ID: "d5d50000-0000-4000-8000-000000000401", Priority: 1, Attribute: "country", Operator: "equals", Expected: json.RawMessage(`"CN"`), Result: true}}}
	fallback := domain.Snapshot{SchemaVersion: 1, ID: "d5d50000-0000-4000-8000-000000000005", Name: "演示：默认值", Key: "demo-default", Environment: "development", Enabled: true, DefaultValue: true, Seed: "d5d50000-0000-4000-8000-000000000905", Revision: 1, CreatedAt: now, UpdatedAt: now, Rules: []domain.Rule{}}
	return []domain.Snapshot{checkout, staging, production, off, fallback}
}
