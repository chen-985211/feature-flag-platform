package infrastructure

import (
	"context"
	app "didi/backend/internal/contexts/audit/application"
	transport "didi/backend/internal/platform/http"
	"encoding/json"
	"net/http"
	"time"
)

type HTTP struct {
	Service    app.Service
	FlagExists func(context.Context, string) error
}
type entryDTO struct {
	ChangesJSON string          `json:"changes_json"`
	ID          string          `json:"id"`
	FlagID      string          `json:"flag_id"`
	Environment string          `json:"environment"`
	Key         string          `json:"key"`
	Revision    int64           `json:"revision"`
	ActorID     string          `json:"actor_id"`
	ActorName   string          `json:"actor_name"`
	Action      string          `json:"action"`
	Changes     json.RawMessage `json:"changes"`
	RequestID   string          `json:"request_id"`
	CreatedAt   time.Time       `json:"created_at"`
}

func (h HTTP) Register(mux *http.ServeMux) {
	mux.HandleFunc("GET /api/flags/{id}/history", func(w http.ResponseWriter, r *http.Request) {
		id := r.PathValue("id")
		limit, offset, ok := transport.Pagination(r)
		if !transport.UUID(id) || !ok {
			transport.Error(w, "INVALID_INPUT")
			return
		}
		if err := h.FlagExists(r.Context(), id); err != nil {
			transport.Error(w, err.Error())
			return
		}
		entries, total, err := h.Service.History(r.Context(), id, limit, offset)
		if err != nil {
			transport.Error(w, err.Error())
			return
		}
		items := []entryDTO{}
		for _, e := range entries {
			items = append(items, entryDTO{ID: e.ID, FlagID: e.FlagID, Environment: e.Environment, Key: e.Key, Revision: e.Revision, ActorID: e.ActorID, ActorName: e.ActorName, Action: e.Action, Changes: e.Changes, ChangesJSON: string(e.Changes), RequestID: e.RequestID, CreatedAt: e.CreatedAt})
		}
		transport.JSON(w, 200, struct {
			Items []entryDTO `json:"items"`
			Total int        `json:"total"`
		}{items, total})
	})
}
