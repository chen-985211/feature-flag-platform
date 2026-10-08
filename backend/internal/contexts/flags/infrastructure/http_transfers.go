package infrastructure

import (
	app "didi/backend/internal/contexts/flags/application"
	"didi/backend/internal/contexts/flags/domain"
	transport "didi/backend/internal/platform/http"
	"net/http"
)

type differenceDTO struct {
	Field  string `json:"field"`
	Before string `json:"before_json"`
	After  string `json:"after_json"`
}

func differencesDTO(changes []domain.Difference) ([]differenceDTO, error) {
	out := []differenceDTO{}
	for _, c := range changes {
		before, after := c.BeforeJSON, c.AfterJSON
		if c.Field == "rules" {
			var err error
			before, err = diffRuleJSON(before)
			if err != nil {
				return nil, err
			}
			after, err = diffRuleJSON(after)
			if err != nil {
				return nil, err
			}
		}
		out = append(out, differenceDTO{c.Field, before, after})
	}
	return out, nil
}
func (h HTTP) registerTransfers(mux *http.ServeMux) {
	mux.Handle("POST /api/flags/{id}/rules/order", h.Mutation(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		var input struct {
			IDs      []string `json:"rule_ids"`
			Expected int64    `json:"expected_revision"`
		}
		if !transport.Decode(w, r, &input) {
			return
		}
		if input.IDs == nil || len(input.IDs) > 100 {
			transport.Error(w, "INVALID_INPUT")
			return
		}
		for _, id := range input.IDs {
			if !transport.UUID(id) {
				transport.Error(w, "INVALID_INPUT")
				return
			}
		}
		h.execute(w, r, app.Command{Action: "rules_reordered", ID: r.PathValue("id"), RuleIDs: input.IDs, ExpectedRevision: input.Expected})
	})))
	mux.Handle("POST /api/flags/{id}/copy", h.Mutation(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		var input struct {
			Source      int64  `json:"source_revision"`
			Environment string `json:"target_environment"`
		}
		if !transport.Decode(w, r, &input) {
			return
		}
		if !transport.UUID(r.PathValue("id")) || !validSource(input.Source) {
			transport.Error(w, "INVALID_INPUT")
			return
		}
		h.execute(w, r, app.Command{Action: "flag_copied", SourceID: r.PathValue("id"), SourceRevision: input.Source, Environment: input.Environment})
	})))
	mux.Handle("POST /api/flags/{id}/publish", h.Mutation(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		var input struct {
			Source   int64  `json:"source_revision"`
			TargetID string `json:"target_id"`
			Expected int64  `json:"expected_revision"`
		}
		if !transport.Decode(w, r, &input) {
			return
		}
		if !transport.UUID(r.PathValue("id")) || !validSource(input.Source) {
			transport.Error(w, "INVALID_INPUT")
			return
		}
		h.execute(w, r, app.Command{Action: "flag_published", ID: input.TargetID, SourceID: r.PathValue("id"), SourceRevision: input.Source, ExpectedRevision: input.Expected})
	})))
	mux.HandleFunc("GET /api/flags/{id}/versions/{revision}/publication", func(w http.ResponseWriter, r *http.Request) {
		id, revision, ok := versionPath(w, r)
		if !ok {
			return
		}
		preview, err := h.Service.PublicationPreview(r.Context(), id, revision, r.URL.Query().Get("target_environment"))
		if err != nil {
			transport.Error(w, err.Error())
			return
		}
		changes, err := differencesDTO(preview.Changes)
		if err != nil {
			transport.Error(w, "INTERNAL_ERROR")
			return
		}
		transport.JSON(w, 200, struct {
			Source         SnapshotDTO     `json:"source"`
			Target         SnapshotDTO     `json:"target"`
			SourceRevision int64           `json:"source_revision"`
			TargetRevision int64           `json:"target_revision"`
			Changes        []differenceDTO `json:"changes"`
		}{snapshotDTO(preview.Source), snapshotDTO(preview.Target), preview.SourceRevision, preview.TargetRevision, changes})
	})
}
func validSource(revision int64) bool { return revision >= 1 && revision <= 9007199254740991 }
