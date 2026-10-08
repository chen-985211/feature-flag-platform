package main

import (
	"didi/backend/migrations"
	"fmt"
	"os"
)

func main() {
	if len(os.Args) != 2 || (os.Args[1] != "up" && os.Args[1] != "down") {
		fmt.Fprintln(os.Stderr, "Usage: didi-migrate up|down (down rolls back one migration)")
		os.Exit(2)
	}
	databaseURL := os.Getenv("DATABASE_URL")
	if databaseURL == "" {
		fmt.Fprintln(os.Stderr, "DATABASE_URL is required")
		os.Exit(2)
	}
	steps := 0
	if os.Args[1] == "down" {
		steps = -1
	}
	if err := migrations.Apply(databaseURL, "public", steps); err != nil {
		// Driver errors can contain SQL or credentials. Keep CLI diagnostics stable and safe.
		fmt.Fprintln(os.Stderr, "MIGRATION_FAILED: check database settings, permissions and schema migration state")
		os.Exit(1)
	}
	fmt.Println("Migration completed")
}
