package infrastructure

import (
	"testing"
	"time"
)

func TestLoginThrottleHasBoundedWindowAndIgnoresPorts(t *testing.T) {
	now := time.Unix(1000, 0)
	l := LoginLimiter{Now: func() time.Time { return now }}
	for i := 0; i < 10; i++ {
		if !l.Allow("127.0.0.1:1234") {
			t.Fatal("early rejection")
		}
	}
	if l.Allow("127.0.0.1:4321") {
		t.Fatal("port bypass")
	}
	if !l.Allow("[::1]:4321") {
		t.Fatal("other address rejected")
	}
	now = now.Add(time.Minute)
	if !l.Allow("127.0.0.1:4321") {
		t.Fatal("window not expired")
	}
}
func TestTokensBindCSRFAndOnlyExposeDigests(t *testing.T) {
	tokens := Tokens{}
	a, b := tokens.New(), tokens.New()
	if len(a) != 64 || a == b || tokens.Hash(a) == a || tokens.CSRF(a) == tokens.CSRF(b) || !tokens.Equal(tokens.CSRF(a), tokens.CSRF(a)) || tokens.Equal(a, b) {
		t.Fatal("invalid token binding")
	}
}
