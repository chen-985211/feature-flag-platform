package infrastructure

import (
	"crypto/hmac"
	"crypto/rand"
	"crypto/sha256"
	"crypto/subtle"
	"encoding/hex"
	"fmt"
	"golang.org/x/crypto/bcrypt"
)

type Passwords struct{}

func (Passwords) Verify(hash, password string) bool {
	return bcrypt.CompareHashAndPassword([]byte(hash), []byte(password)) == nil
}
func (Passwords) Hash(password string) (string, error) {
	raw, err := bcrypt.GenerateFromPassword([]byte(password), 12)
	return string(raw), err
}

type Tokens struct{}

func (Tokens) New() string {
	raw := make([]byte, 32)
	if _, err := rand.Read(raw); err != nil {
		panic("SECURE_RANDOM_FAILED")
	}
	return hex.EncodeToString(raw)
}
func (Tokens) Hash(raw string) string {
	hash := sha256.Sum256([]byte(raw))
	return hex.EncodeToString(hash[:])
}
func (Tokens) CSRF(token string) string {
	h := hmac.New(sha256.New, []byte(token))
	if _, err := h.Write([]byte("didi.csrf.v1")); err != nil {
		panic("CSRF_HASH_FAILED")
	}
	return hex.EncodeToString(h.Sum(nil))
}
func (Tokens) Equal(a, b string) bool { return subtle.ConstantTimeCompare([]byte(a), []byte(b)) == 1 }
func NewID() string {
	raw := make([]byte, 16)
	if _, err := rand.Read(raw); err != nil {
		panic("SECURE_RANDOM_FAILED")
	}
	raw[6] = raw[6]&0x0f | 0x40
	raw[8] = raw[8]&0x3f | 0x80
	return fmt.Sprintf("%x-%x-%x-%x-%x", raw[:4], raw[4:6], raw[6:8], raw[8:10], raw[10:])
}
