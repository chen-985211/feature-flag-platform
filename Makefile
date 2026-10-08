.PHONY: check-docs check test-unit test-component test-contract test-integration test-race build migrate dev dev-backend verify verify-full
check-docs:
	pnpm check:docs
check:
	pnpm check
test-unit:
	pnpm test:unit
test-component:
	pnpm test:component
test-contract:
	pnpm test:contract
test-integration:
	pnpm test:integration
test-race:
	pnpm test:race
build:
	pnpm build
migrate:
	pnpm migrate
dev:
	pnpm dev
dev-backend:
	pnpm dev:backend
verify:
	pnpm verify
verify-full:
	pnpm verify:full
.PHONY: seed-users seed-demo test-e2e test-e2e-stability
seed-users:
	pnpm seed:users
seed-demo:
	pnpm seed:demo
test-e2e:
	pnpm test:e2e
test-e2e-stability:
	pnpm test:e2e:stability
.PHONY: docker-build docker-up docker-down docker-seed test-docker
docker-build:
	pnpm docker:build
docker-up:
	pnpm docker:up
docker-down:
	pnpm docker:down
docker-seed:
	pnpm docker:seed
test-docker:
	pnpm test:docker
