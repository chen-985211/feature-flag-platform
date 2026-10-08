package healthcheck

import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"time"
)

var ErrNotReady = errors.New("HEALTHCHECK_FAILED")

func Ready(ctx context.Context, endpoint string) (result error) {
	request, err := http.NewRequestWithContext(ctx, http.MethodGet, endpoint, nil)
	if err != nil {
		return ErrNotReady
	}
	response, err := (&http.Client{Timeout: 2 * time.Second}).Do(request)
	if err != nil {
		return ErrNotReady
	}
	defer func() {
		if err := response.Body.Close(); err != nil {
			result = ErrNotReady
		}
	}()
	if response.StatusCode != http.StatusOK {
		return ErrNotReady
	}
	var payload struct {
		Status string `json:"status"`
	}
	if json.NewDecoder(io.LimitReader(response.Body, 1024)).Decode(&payload) != nil || payload.Status != "ready" {
		return ErrNotReady
	}
	return nil
}
