package infrastructure

import (
	app "didi/backend/internal/contexts/flags/application"
	"didi/backend/internal/contexts/flags/domain"
	transport "didi/backend/internal/platform/http"
	"encoding/json"
	"net/http"
	"strconv"
	"time"
)

type versionSummaryDTO struct {
	Revision      int64     `json:"revision"`
	SchemaVersion int       `json:"schema_version"`
	ActorID       string    `json:"actor_id"`
	ActorName     string    `json:"actor_name"`
	CreatedAt     time.Time `json:"created_at"`
}
type versionDTO struct {
	versionSummaryDTO
	Snapshot SnapshotDTO `json:"snapshot"`
}

func summaryDTO(v app.VersionSummary) versionSummaryDTO {
	return versionSummaryDTO{Revision: v.Revision, SchemaVersion: v.SchemaVersion, ActorID: v.ActorID, ActorName: v.ActorName, CreatedAt: v.CreatedAt}
}
func versionPath(w http.ResponseWriter, r *http.Request) (string, int64, bool) {
	id := r.PathValue("id")
	revision, err := strconv.ParseInt(r.PathValue("revision"), 10, 64)
	if !transport.UUID(id) || err != nil || revision < 1 || revision > 9007199254740991 {
		transport.Error(w, "INVALID_INPUT")
		return "", 0, false
	}
	return id, revision, true
}
func (h HTTP) registerVersions(mux *http.ServeMux) {
	mux.HandleFunc("GET /api/flags/{id}/versions", func(w http.ResponseWriter, r *http.Request) {
		id := r.PathValue("id")
		limit, offset, ok := transport.Pagination(r)
		if !transport.UUID(id) || !ok {
			transport.Error(w, "INVALID_INPUT")
			return
		}
		page, err := h.Service.Versions(r.Context(), id, limit, offset)
		if err != nil {
			transport.Error(w, err.Error())
			return
		}
		items := []versionSummaryDTO{}
		for _, v := range page.Items {
			items = append(items, summaryDTO(v))
		}
		transport.JSON(w, 200, struct {
			Items []versionSummaryDTO `json:"items"`
			Total int                 `json:"total"`
		}{items, page.Total})
	})
	mux.HandleFunc("GET /api/flags/{id}/versions/{revision}", func(w http.ResponseWriter, r *http.Request) {
		id, revision, ok := versionPath(w, r)
		if !ok {
			return
		}
		v, err := h.Service.Version(r.Context(), id, revision)
		if err != nil {
			transport.Error(w, err.Error())
			return
		}
		transport.JSON(w, 200, versionDTO{versionSummaryDTO: summaryDTO(v.VersionSummary), Snapshot: snapshotDTO(v.Snapshot)})
	})
	mux.HandleFunc("GET /api/flags/{id}/versions/{revision}/diff", func(w http.ResponseWriter, r *http.Request) {
		id, revision, ok := versionPath(w, r)
		if !ok {
			return
		}
		preview, err := h.Service.Preview(r.Context(), id, revision)
		if err != nil {
			transport.Error(w, err.Error())
			return
		}
		type change struct {
			Field  string `json:"field"`
			Before string `json:"before_json"`
			After  string `json:"after_json"`
		}
		changes := []change{}
		for _, c := range preview.Changes {
			before, after := c.BeforeJSON, c.AfterJSON
			if c.Field == "rules" {
				var convertErr error
				before, convertErr = diffRuleJSON(before)
				if convertErr != nil {
					transport.Error(w, "INTERNAL_ERROR")
					return
				}
				after, convertErr = diffRuleJSON(after)
				if convertErr != nil {
					transport.Error(w, "INTERNAL_ERROR")
					return
				}
			}
			changes = append(changes, change{Field: c.Field, Before: before, After: after})
		}
		transport.JSON(w, 200, struct {
			Current  int64       `json:"current_revision"`
			Source   int64       `json:"source_revision"`
			Snapshot SnapshotDTO `json:"source"`
			Changes  []change    `json:"changes"`
		}{preview.CurrentRevision, preview.SourceRevision, snapshotDTO(preview.Source), changes})
	})
	mux.Handle("POST /api/flags/{id}/rollback", h.Mutation(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		var input struct {
			Source   int64 `json:"source_revision"`
			Expected int64 `json:"expected_revision"`
		}
		if !transport.Decode(w, r, &input) {
			return
		}
		if input.Source < 1 || input.Source > 9007199254740991 {
			transport.Error(w, "INVALID_INPUT")
			return
		}
		h.execute(w, r, app.Command{Action: "flag_rolled_back", ID: r.PathValue("id"), SourceRevision: input.Source, ExpectedRevision: input.Expected})
	})))
}

func diffRuleJSON(raw string) (string, error) {
	var rules []domain.Rule
	if err := json.Unmarshal([]byte(raw), &rules); err != nil {
		return "", err
	}
	// JSON null decodes into the RawMessage lexeme "null". Percentage rules
	// carry no expected value, including when they travel through a diff.
	for i := range rules {
		if rules[i].Kind == "percentage" {
			rules[i].Expected = nil
		}
	}
	encoded, err := json.Marshal(snapshotDTO(domain.Snapshot{Rules: rules}).Rules)
	return string(encoded), err
}
