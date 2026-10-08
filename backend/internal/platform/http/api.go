package httptransport

import (
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"errors"
	"io"
	"log/slog"
	"mime"
	"net/http"
	"strconv"
	"time"
)

func JSON(w http.ResponseWriter, status int, value any) { writeJSON(w, status, value) }
func Error(w http.ResponseWriter, code string) {
	status := 500
	message := "服务暂时无法处理请求，请稍后重试。"
	switch code {
	case "INVALID_INPUT", "INVALID_USER_ATTRIBUTES":
		status = 400
		message = "输入格式或字段不合法。"
	case "UNAUTHENTICATED":
		status = 401
		message = "账号或密码不正确，或会话已失效。"
	case "FORBIDDEN":
		status = 403
		message = "当前账号没有此环境的修改权限。"
	case "CSRF_REJECTED":
		status = 403
		message = "请求校验失败，请刷新页面后重试。"
	case "FLAG_NOT_FOUND", "RULE_NOT_FOUND", "VERSION_NOT_FOUND":
		status = 404
		message = "配置或规则不存在。"
	case "TARGET_NOT_FOUND":
		status = 404
		message = "目标环境还没有相同 Key，请先复制配置。"
	case "VERSION_CONFLICT":
		status = 409
		message = "配置已被更新，请查看最新版本。"
	case "FLAG_KEY_CONFLICT":
		status = 409
		message = "当前环境已存在相同 Key。"
	case "PRIORITY_CONFLICT":
		status = 409
		message = "优先级已被其他规则使用。"
	case "RATE_LIMITED":
		status = 429
		message = "登录尝试过于频繁，请稍后重试。"
	default:
		code = "INTERNAL_ERROR"
	}
	writeJSON(w, status, errorResponse{Error: errorDetails{Code: code, Message: message, RequestID: w.Header().Get("X-Request-ID")}})
}
func Decode(w http.ResponseWriter, r *http.Request, value any) bool {
	kind, _, err := mime.ParseMediaType(r.Header.Get("Content-Type"))
	if err != nil || kind != "application/json" {
		Error(w, "INVALID_INPUT")
		return false
	}
	r.Body = http.MaxBytesReader(w, r.Body, 64<<10)
	decoder := json.NewDecoder(r.Body)
	decoder.DisallowUnknownFields()
	if err = decoder.Decode(value); err != nil {
		Error(w, "INVALID_INPUT")
		return false
	}
	if err = decoder.Decode(new(any)); !errors.Is(err, io.EOF) {
		Error(w, "INVALID_INPUT")
		return false
	}
	return true
}
func UUID(raw string) bool {
	if len(raw) != 36 || raw[8] != '-' || raw[13] != '-' || raw[18] != '-' || raw[23] != '-' {
		return false
	}
	joined := raw[:8] + raw[9:13] + raw[14:18] + raw[19:23] + raw[24:]
	_, err := hex.DecodeString(joined)
	return err == nil
}
func Pagination(r *http.Request) (int, int, bool) {
	limit, offset := 50, 0
	var err error
	if raw := r.URL.Query().Get("limit"); raw != "" {
		limit, err = strconv.Atoi(raw)
		if err != nil {
			return 0, 0, false
		}
	}
	if raw := r.URL.Query().Get("offset"); raw != "" {
		offset, err = strconv.Atoi(raw)
		if err != nil {
			return 0, 0, false
		}
	}
	return limit, offset, limit >= 1 && limit <= 100 && offset >= 0 && offset <= 1000000
}

type recorded struct {
	http.ResponseWriter
	status int
}

func (w *recorded) WriteHeader(code int) {
	if w.status == 0 {
		w.status = code
		w.ResponseWriter.WriteHeader(code)
	}
}
func (w *recorded) Write(p []byte) (int, error) {
	if w.status == 0 {
		w.WriteHeader(200)
	}
	return w.ResponseWriter.Write(p)
}
func Middleware(logger *slog.Logger, next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("X-Request-ID", rand.Text())
		w.Header().Set("Cache-Control", "no-store")
		w.Header().Set("X-Content-Type-Options", "nosniff")
		writer := &recorded{ResponseWriter: w}
		started := time.Now()
		defer func() {
			if recover() != nil {
				Error(writer, "INTERNAL_ERROR")
				logger.Error("API request failed", "request_id", w.Header().Get("X-Request-ID"), "error_code", "INTERNAL_ERROR", "scope", "api")
			}
			if writer.status >= 500 {
				logger.Error("API request failed", "request_id", w.Header().Get("X-Request-ID"), "operation", r.Method, "scope", "api", "outcome", writer.status, "duration", time.Since(started))
			}
		}()
		next.ServeHTTP(writer, r)
	})
}
