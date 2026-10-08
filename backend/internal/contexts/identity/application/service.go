package application

import (
	"context"
	"didi/backend/internal/contexts/identity/domain"
	"errors"
	"strings"
	"time"
	"unicode/utf8"
)

var ErrUnauthenticated = errors.New("UNAUTHENTICATED")
var ErrInvalid = errors.New("INVALID_INPUT")

type User struct{ ID, Username, Name, Role, PasswordHash string }
type Session struct {
	User                User
	TokenHash, CSRFHash string
	ExpiresAt           time.Time
}
type Store interface {
	User(context.Context, string) (User, error)
	SaveSession(context.Context, Session) error
	Session(context.Context, string, time.Time) (Session, error)
	Revoke(context.Context, string, time.Time) error
}
type Passwords interface{ Verify(string, string) bool }
type Tokens interface {
	New() string
	Hash(string) string
	CSRF(string) string
	Equal(string, string) bool
}
type Service struct {
	Store     Store
	Passwords Passwords
	Tokens    Tokens
	Now       func() time.Time
	TTL       time.Duration
	DummyHash string
}

func (s Service) Login(ctx context.Context, username, password string) (Session, string, error) {
	if strings.TrimSpace(username) != username || utf8.RuneCountInString(username) < 1 || utf8.RuneCountInString(username) > 80 || len(password) < 1 || len(password) > 72 {
		return Session{}, "", ErrInvalid
	}
	user, err := s.Store.User(ctx, username)
	if err != nil && !errors.Is(err, ErrUnauthenticated) {
		return Session{}, "", err
	}
	hash := user.PasswordHash
	if err != nil {
		hash = s.DummyHash
	}
	valid := s.Passwords.Verify(hash, password)
	if !valid || err != nil {
		return Session{}, "", ErrUnauthenticated
	}
	token := s.Tokens.New()
	session := Session{User: user, TokenHash: s.Tokens.Hash(token), CSRFHash: s.Tokens.Hash(s.Tokens.CSRF(token)), ExpiresAt: s.Now().Add(s.TTL)}
	if err = s.Store.SaveSession(ctx, session); err != nil {
		return Session{}, "", err
	}
	return session, token, nil
}
func (s Service) Resolve(ctx context.Context, token string) (Session, error) {
	if len(token) != 64 {
		return Session{}, ErrUnauthenticated
	}
	session, err := s.Store.Session(ctx, s.Tokens.Hash(token), s.Now())
	if err != nil {
		return Session{}, err
	}
	if !s.Tokens.Equal(session.CSRFHash, s.Tokens.Hash(s.Tokens.CSRF(token))) {
		return Session{}, ErrUnauthenticated
	}
	return session, nil
}
func (s Service) ValidCSRF(session Session, raw string) bool {
	return len(raw) == 64 && s.Tokens.Equal(session.CSRFHash, s.Tokens.Hash(raw))
}
func (s Service) Logout(ctx context.Context, session Session) error {
	return s.Store.Revoke(ctx, session.TokenHash, s.Now())
}
func Capabilities(role string) []string {
	out := []string{}
	for _, env := range []string{"development", "staging", "production"} {
		if domain.CanWrite(role, env) {
			out = append(out, env)
		}
	}
	return out
}
