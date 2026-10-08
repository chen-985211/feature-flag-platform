package infrastructure

import (
	"context"
	app "didi/backend/internal/contexts/identity/application"
	"errors"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"time"
)

type Repository struct{ Pool *pgxpool.Pool }

func (r Repository) User(ctx context.Context, username string) (app.User, error) {
	var u app.User
	err := r.Pool.QueryRow(ctx, `SELECT id::text,username,display_name,role,password_hash FROM users WHERE username=$1`, username).Scan(&u.ID, &u.Username, &u.Name, &u.Role, &u.PasswordHash)
	if errors.Is(err, pgx.ErrNoRows) {
		err = app.ErrUnauthenticated
	}
	return u, err
}
func (r Repository) SaveSession(ctx context.Context, s app.Session) error {
	_, err := r.Pool.Exec(ctx, `INSERT INTO sessions(token_hash,user_id,csrf_hash,expires_at) VALUES($1,$2,$3,$4)`, s.TokenHash, s.User.ID, s.CSRFHash, s.ExpiresAt)
	return err
}
func (r Repository) Session(ctx context.Context, hash string, now time.Time) (app.Session, error) {
	var s app.Session
	err := r.Pool.QueryRow(ctx, `SELECT u.id::text,u.username,u.display_name,u.role,s.token_hash,s.csrf_hash,s.expires_at FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=$1 AND s.revoked_at IS NULL AND s.expires_at>$2`, hash, now).Scan(&s.User.ID, &s.User.Username, &s.User.Name, &s.User.Role, &s.TokenHash, &s.CSRFHash, &s.ExpiresAt)
	if errors.Is(err, pgx.ErrNoRows) {
		err = app.ErrUnauthenticated
	}
	return s, err
}
func (r Repository) Revoke(ctx context.Context, hash string, now time.Time) error {
	_, err := r.Pool.Exec(ctx, `UPDATE sessions SET revoked_at=$2 WHERE token_hash=$1 AND revoked_at IS NULL`, hash, now)
	return err
}
func (r Repository) SeedUser(ctx context.Context, username, name, role, password string) error {
	if len(password) < 8 || len(password) > 72 {
		return app.ErrInvalid
	}
	hash, err := (Passwords{}).Hash(password)
	if err != nil {
		return err
	}
	_, err = r.Pool.Exec(ctx, `INSERT INTO users(id,username,password_hash,display_name,role) VALUES($1,$2,$3,$4,$5) ON CONFLICT(username) DO NOTHING`, NewID(), username, hash, name, role)
	return err
}
