package main

import (
	"context"
	"didi/backend/internal/platform/healthcheck"
	"fmt"
	"os"
)

func main() {
	if err := healthcheck.Ready(context.Background(), "http://127.0.0.1:8080/health/ready"); err != nil {
		fmt.Fprintln(os.Stderr, "HEALTHCHECK_FAILED")
		os.Exit(1)
	}
}
