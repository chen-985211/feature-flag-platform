SHELL := /bin/sh

-include .env
export

.PHONY: help check-docs test-backend test-race vet-backend build-backend dev-backend check-backend

help:
	@printf '%s\n' '当前已实现：check-docs test-backend test-race vet-backend build-backend dev-backend check-backend' '完整前端、迁移与 Docker 命令仍待实现。'

check-docs:
	python3 scripts/check_docs.py

test-backend:
	cd backend && go test ./internal/... -count=1

test-race:
	cd backend && go test -race ./... -count=1

vet-backend:
	cd backend && go vet ./...

build-backend:
	mkdir -p .build
	cd backend && go build -o ../.build/didi-server ./cmd/server

dev-backend:
	cd backend && go run ./cmd/server

check-backend: check-docs test-backend test-race vet-backend build-backend
