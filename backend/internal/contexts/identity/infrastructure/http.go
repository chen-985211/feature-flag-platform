package infrastructure

import (
	"context"
	app "didi/backend/internal/contexts/identity/application"
	transport "didi/backend/internal/platform/http"
	"net"
	"net/http"
	"strings"
	"sync"
	"time"
)

const cookieName = "didi_session"

type sessionKey struct{}
type HTTP struct {
	Service app.Service
	Origin  string
	Limiter *LoginLimiter
}
type SessionDTO struct {
	User              UserDTO  `json:"user"`
	WriteEnvironments []string `json:"write_environments"`
	CSRFToken         string   `json:"csrf_token"`
}
type UserDTO struct {
	ID          string `json:"id"`
	Username    string `json:"username"`
	DisplayName string `json:"display_name"`
	Role        string `json:"role"`
}

func (h HTTP) response(session app.Session, token string) SessionDTO {
	return SessionDTO{User: UserDTO{ID: session.User.ID, Username: session.User.Username, DisplayName: session.User.Name, Role: session.User.Role}, WriteEnvironments: app.Capabilities(session.User.Role), CSRFToken: h.Service.Tokens.CSRF(token)}
}
func SessionFrom(r *http.Request) app.Session {
	session, _ := r.Context().Value(sessionKey{}).(app.Session)
	return session
}
func (h HTTP) Register(mux *http.ServeMux) {
	mux.HandleFunc("POST /api/auth/login", func(w http.ResponseWriter, r *http.Request) {
		if r.Header.Get("Origin") != h.Origin {
			transport.Error(w, "CSRF_REJECTED")
			return
		}
		if !h.Limiter.Allow(r.RemoteAddr) {
			w.Header().Set("Retry-After", "60")
			transport.Error(w, "RATE_LIMITED")
			return
		}
		var input struct {
			Username string `json:"username"`
			Password string `json:"password"`
		}
		if !transport.Decode(w, r, &input) {
			return
		}
		session, token, err := h.Service.Login(r.Context(), input.Username, input.Password)
		if err != nil {
			transport.Error(w, err.Error())
			return
		}
		http.SetCookie(w, &http.Cookie{Name: cookieName, Value: token, Path: "/", HttpOnly: true, SameSite: http.SameSiteLaxMode, Secure: strings.HasPrefix(h.Origin, "https://"), Expires: session.ExpiresAt, MaxAge: int(h.Service.TTL.Seconds())})
		transport.JSON(w, 200, h.response(session, token))
	})
	mux.Handle("GET /api/auth/session", h.Auth(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		cookie, err := r.Cookie(cookieName)
		if err != nil {
			transport.Error(w, "UNAUTHENTICATED")
			return
		}
		transport.JSON(w, 200, h.response(SessionFrom(r), cookie.Value))
	})))
	mux.Handle("POST /api/auth/logout", h.Auth(h.Mutation(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if err := h.Service.Logout(r.Context(), SessionFrom(r)); err != nil {
			transport.Error(w, err.Error())
			return
		}
		http.SetCookie(w, &http.Cookie{Name: cookieName, Value: "", Path: "/", HttpOnly: true, SameSite: http.SameSiteLaxMode, Secure: strings.HasPrefix(h.Origin, "https://"), MaxAge: -1, Expires: time.Unix(1, 0)})
		w.WriteHeader(204)
	}))))
}
func (h HTTP) Auth(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		cookie, err := r.Cookie(cookieName)
		if err != nil {
			transport.Error(w, "UNAUTHENTICATED")
			return
		}
		session, err := h.Service.Resolve(r.Context(), cookie.Value)
		if err != nil {
			transport.Error(w, err.Error())
			return
		}
		next.ServeHTTP(w, r.WithContext(context.WithValue(r.Context(), sessionKey{}, session)))
	})
}
func (h HTTP) Mutation(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Header.Get("Origin") != h.Origin || !h.Service.ValidCSRF(SessionFrom(r), r.Header.Get("X-CSRF-Token")) {
			transport.Error(w, "CSRF_REJECTED")
			return
		}
		next.ServeHTTP(w, r)
	})
}

type attempt struct {
	Count   int
	Expires time.Time
}
type LoginLimiter struct {
	mu      sync.Mutex
	entries map[string]attempt
	Now     func() time.Time
}

func (l *LoginLimiter) Allow(address string) bool {
	host, _, err := net.SplitHostPort(address)
	if err != nil {
		host = address
	}
	l.mu.Lock()
	defer l.mu.Unlock()
	now := l.Now()
	if l.entries == nil {
		l.entries = map[string]attempt{}
	}
	for key, entry := range l.entries {
		if !entry.Expires.After(now) {
			delete(l.entries, key)
		}
	}
	entry, ok := l.entries[host]
	if !ok {
		if len(l.entries) >= 4096 {
			return false
		}
		entry = attempt{Expires: now.Add(time.Minute)}
	}
	if entry.Count >= 10 {
		return false
	}
	entry.Count++
	l.entries[host] = entry
	return true
}
