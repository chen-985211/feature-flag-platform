FROM node:24.21.0-bookworm-slim@sha256:d6aa754f16b3197301076f047b5def2f02ea1dbbc2ca920407d46d7ec7f87b20 AS frontend
WORKDIR /src
RUN npm install --global pnpm@10.33.0
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY frontend/package.json frontend/package.json
RUN pnpm install --frozen-lockfile
COPY frontend frontend
RUN pnpm --dir frontend build

FROM golang:1.27.0-bookworm@sha256:ded31c68586d2e49e760acc2e65a884b23d032e9bbbed0ae0c55abd3fcaf4452 AS backend
WORKDIR /src/backend
COPY backend/go.mod backend/go.sum ./
RUN go mod download
COPY backend ./
COPY --from=frontend /src/frontend/dist ./internal/platform/web/assets
RUN CGO_ENABLED=0 go build -trimpath -buildvcs=false -o /out/didi-server ./cmd/server \
    && CGO_ENABLED=0 go build -trimpath -buildvcs=false -o /out/didi-migrate ./cmd/migrate \
    && CGO_ENABLED=0 go build -trimpath -buildvcs=false -o /out/didi-seed ./cmd/seed \
    && CGO_ENABLED=0 go build -trimpath -buildvcs=false -o /out/didi-healthcheck ./cmd/healthcheck

FROM scratch AS runtime
COPY --from=backend /etc/ssl/certs/ca-certificates.crt /etc/ssl/certs/ca-certificates.crt
COPY --from=backend --chown=65532:65532 /out/ /app/
USER 65532:65532
EXPOSE 8080
ENTRYPOINT ["/app/didi-server"]
