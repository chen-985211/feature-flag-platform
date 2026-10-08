package infrastructure

import (
	app "didi/backend/internal/contexts/flags/application"
	"didi/backend/internal/contexts/flags/domain"
	transport "didi/backend/internal/platform/http"
	"encoding/json"
	"net/http"
	"strconv"
	"unicode/utf8"
)

type HTTP struct {
	Service  app.Service
	Actor    func(*http.Request) app.Actor
	Mutation func(http.Handler) http.Handler
}

func (h HTTP) Register(mux *http.ServeMux) {
	h.registerVersions(mux)
	h.registerTransfers(mux)
	mux.HandleFunc("GET /api/flags", h.list)
	mux.HandleFunc("GET /api/flags/{id}", func(w http.ResponseWriter, r *http.Request) {
		if !transport.UUID(r.PathValue("id")) {
			transport.Error(w, "INVALID_INPUT")
			return
		}
		s, err := h.Service.Store.Get(r.Context(), r.PathValue("id"))
		if err != nil {
			transport.Error(w, err.Error())
			return
		}
		transport.JSON(w, 200, snapshotDTO(s))
	})
	mux.Handle("POST /api/flags", h.Mutation(http.HandlerFunc(h.create)))
	mux.Handle("PUT /api/flags/{id}", h.Mutation(http.HandlerFunc(h.edit)))
	mux.Handle("PATCH /api/flags/{id}/enabled", h.Mutation(http.HandlerFunc(h.enabled)))
	mux.Handle("POST /api/flags/{id}/rules", h.Mutation(http.HandlerFunc(h.rule)))
	mux.Handle("PUT /api/flags/{id}/rules/{ruleId}", h.Mutation(http.HandlerFunc(h.rule)))
	mux.Handle("DELETE /api/flags/{id}/rules/{ruleId}", h.Mutation(http.HandlerFunc(h.deleteRule)))
	mux.HandleFunc("POST /api/evaluations", h.evaluate)
}
func (h HTTP) execute(w http.ResponseWriter, r *http.Request, c app.Command) {
	if c.Action != "flag_created" && c.Action != "flag_copied" && (!transport.UUID(c.ID) || c.ExpectedRevision < 1 || c.ExpectedRevision > 9007199254740991) || c.RuleID != "" && !transport.UUID(c.RuleID) {
		transport.Error(w, "INVALID_INPUT")
		return
	}
	s, err := h.Service.Execute(r.Context(), h.Actor(r), w.Header().Get("X-Request-ID"), c)
	if err != nil {
		transport.Error(w, err.Error())
		return
	}
	status := 200
	if c.Action == "flag_created" || c.Action == "flag_copied" {
		status = 201
	}
	transport.JSON(w, status, snapshotDTO(s))
}
func (h HTTP) list(w http.ResponseWriter, r *http.Request) {
	limit, offset, ok := transport.Pagination(r)
	env := r.URL.Query().Get("environment")
	q := r.URL.Query().Get("q")
	if !ok || !domain.ValidEnvironment(env) || utf8.RuneCountInString(q) > 160 {
		transport.Error(w, "INVALID_INPUT")
		return
	}
	var enabled *bool
	if raw := r.URL.Query().Get("enabled"); raw != "" {
		b, err := strconv.ParseBool(raw)
		if err != nil || raw != "true" && raw != "false" {
			transport.Error(w, "INVALID_INPUT")
			return
		}
		enabled = &b
	}
	page, err := h.Service.Store.List(r.Context(), app.Filter{Environment: env, Query: q, Enabled: enabled, Limit: limit, Offset: offset})
	if err != nil {
		transport.Error(w, err.Error())
		return
	}
	items := []SnapshotDTO{}
	for _, s := range page.Items {
		items = append(items, snapshotDTO(s))
	}
	transport.JSON(w, 200, struct {
		Items []SnapshotDTO `json:"items"`
		Total int           `json:"total"`
	}{items, page.Total})
}
func (h HTTP) create(w http.ResponseWriter, r *http.Request) {
	var in struct {
		Name         string `json:"name"`
		Key          string `json:"key"`
		Environment  string `json:"environment"`
		Enabled      *bool  `json:"enabled"`
		DefaultValue *bool  `json:"default_value"`
	}
	if !transport.Decode(w, r, &in) {
		return
	}
	if in.Enabled == nil || in.DefaultValue == nil {
		transport.Error(w, "INVALID_INPUT")
		return
	}
	h.execute(w, r, app.Command{Action: "flag_created", Name: in.Name, Key: in.Key, Environment: in.Environment, Enabled: *in.Enabled, DefaultValue: *in.DefaultValue})
}
func (h HTTP) edit(w http.ResponseWriter, r *http.Request) {
	var in struct {
		Name             string `json:"name"`
		Key              string `json:"key"`
		DefaultValue     *bool  `json:"default_value"`
		ExpectedRevision int64  `json:"expected_revision"`
	}
	if !transport.Decode(w, r, &in) {
		return
	}
	if in.DefaultValue == nil {
		transport.Error(w, "INVALID_INPUT")
		return
	}
	h.execute(w, r, app.Command{Action: "flag_edited", ID: r.PathValue("id"), Name: in.Name, Key: in.Key, DefaultValue: *in.DefaultValue, ExpectedRevision: in.ExpectedRevision})
}
func (h HTTP) enabled(w http.ResponseWriter, r *http.Request) {
	var in struct {
		Enabled          *bool `json:"enabled"`
		ExpectedRevision int64 `json:"expected_revision"`
	}
	if !transport.Decode(w, r, &in) {
		return
	}
	if in.Enabled == nil {
		transport.Error(w, "INVALID_INPUT")
		return
	}
	h.execute(w, r, app.Command{Action: "flag_enabled", ID: r.PathValue("id"), Enabled: *in.Enabled, ExpectedRevision: in.ExpectedRevision})
}
func (h HTTP) rule(w http.ResponseWriter, r *http.Request) {
	var in struct {
		Kind             string          `json:"kind"`
		PercentageBP     *int            `json:"percentage_bp"`
		Attribute        string          `json:"attribute"`
		Operator         string          `json:"operator"`
		Expected         json.RawMessage `json:"expected"`
		Priority         int             `json:"priority"`
		Result           *bool           `json:"result"`
		ExpectedRevision int64           `json:"expected_revision"`
	}
	if !transport.Decode(w, r, &in) {
		return
	}
	if in.Result == nil {
		transport.Error(w, "INVALID_INPUT")
		return
	}
	action := "rule_created"
	if r.Method == "PUT" {
		action = "rule_edited"
	}
	h.execute(w, r, app.Command{Action: action, ID: r.PathValue("id"), RuleID: r.PathValue("ruleId"), ExpectedRevision: in.ExpectedRevision, Rule: domain.Rule{Kind: in.Kind, PercentageBP: in.PercentageBP, Attribute: in.Attribute, Operator: in.Operator, Expected: in.Expected, Priority: in.Priority, Result: *in.Result}})
}
func (h HTTP) deleteRule(w http.ResponseWriter, r *http.Request) {
	var in struct {
		ExpectedRevision int64 `json:"expected_revision"`
	}
	if !transport.Decode(w, r, &in) {
		return
	}
	h.execute(w, r, app.Command{Action: "rule_deleted", ID: r.PathValue("id"), RuleID: r.PathValue("ruleId"), ExpectedRevision: in.ExpectedRevision})
}
func (h HTTP) evaluate(w http.ResponseWriter, r *http.Request) {
	var in struct {
		Key         string          `json:"key"`
		Environment string          `json:"environment"`
		Attributes  json.RawMessage `json:"attributes"`
	}
	if !transport.Decode(w, r, &in) {
		return
	}
	var attrs map[string]json.RawMessage
	if json.Unmarshal(in.Attributes, &attrs) != nil || attrs == nil {
		transport.Error(w, "INVALID_USER_ATTRIBUTES")
		return
	}
	result, err := h.Service.Evaluate(r.Context(), in.Environment, in.Key, in.Attributes)
	if err != nil {
		transport.Error(w, err.Error())
		return
	}
	transport.JSON(w, 200, resultDTO(result))
}
