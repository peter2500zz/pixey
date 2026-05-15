# ── Stage 1: Build frontend ───────────────────────────────────────────────────
FROM oven/bun:1-slim AS frontend-builder

WORKDIR /src/frontend
COPY frontend/package.json frontend/bun.lock ./
RUN bun install --frozen-lockfile

COPY frontend/ ./
# vite.config.ts: outDir = '../internal/web/dist'  →  /src/internal/web/dist
RUN bun run build

# ── Stage 2: Build Go binary ─────────────────────────────────────────────────
FROM golang:1.22-alpine AS go-builder

WORKDIR /src
COPY go.mod go.sum ./
RUN go mod download

COPY . .
# Overlay the built frontend assets (gitignored in source tree)
COPY --from=frontend-builder /src/internal/web/dist ./internal/web/dist

RUN CGO_ENABLED=0 GOOS=linux go build -ldflags="-s -w" -o pixey .

# ── Stage 3: Minimal runtime ──────────────────────────────────────────────────
FROM alpine:3.20

# ca-certificates: needed for HTTPS upstream proxies
# tzdata: allows TZ env var to work in logs
RUN apk add --no-cache ca-certificates tzdata

WORKDIR /app
COPY --from=go-builder /src/pixey .

# data/ holds totp_secret and credentials.json; mount as volume for persistence
VOLUME ["/app/data"]

# 7070 = proxy port, 7071 = web management UI
EXPOSE 7070 7071

ENTRYPOINT ["./pixey"]
