.PHONY: build dev frontend backend clean release

# ── Build ─────────────────────────────────────────────────────────────────────

build: frontend backend
	@echo "✓ Build complete — binary: pixey"

frontend:
	@echo "→ Building frontend..."
	cd frontend && bun run build

backend:
	@echo "→ Building backend..."
	go build -o pixey .

# ── Development ───────────────────────────────────────────────────────────────
# Run both servers: Go backend on :7071 (API only) + Vite dev server on :5173
dev:
	@echo "→ Starting dev servers..."
	@echo "   Web UI : http://localhost:5173"
	@echo "   API    : http://localhost:7071"
	@echo "   Proxy  : http://localhost:7070"
	@$(MAKE) -j2 dev-backend dev-frontend

dev-backend:
	go run .

dev-frontend:
	cd frontend && bun run dev

# ── Release (cross-platform) ──────────────────────────────────────────────────
release: frontend
	@echo "→ Cross-compiling..."
	GOOS=linux   GOARCH=amd64  go build -o dist/pixey-linux-amd64   .
	GOOS=linux   GOARCH=arm64  go build -o dist/pixey-linux-arm64   .
	GOOS=darwin  GOARCH=amd64  go build -o dist/pixey-darwin-amd64  .
	GOOS=darwin  GOARCH=arm64  go build -o dist/pixey-darwin-arm64  .
	GOOS=windows GOARCH=amd64  go build -o dist/pixey-windows-amd64.exe .
	@echo "✓ Releases in dist/"

# ── Utilities ─────────────────────────────────────────────────────────────────
clean:
	rm -f pixey
	rm -rf dist/
	rm -rf internal/web/dist/

deps:
	go mod tidy
	cd frontend && bun install
