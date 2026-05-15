# Pixey — AI Context Guide

> This file exists so that AI assistants (including Claude Code) can understand
> the project architecture quickly and make accurate, targeted changes.

## What Pixey does

Pixey is a **reverse proxy authenticator**: it sits in front of an upstream
HTTP/HTTPS proxy, adds its own credential layer, and exposes a TOTP-protected
web UI to manage those credentials. Clients authenticate to Pixey's proxy with
short-lived usernames/passwords; Pixey then forwards requests to the upstream
proxy (adding its credentials if configured).

## Directory layout

```
pixey/
├── main.go                      # Entry: starts proxy + web servers
├── config.yaml                  # Runtime config (not committed in prod)
├── Makefile                     # Build targets
│
├── internal/
│   ├── config/config.go         # Config struct + YAML loading
│   ├── auth/
│   │   ├── store.go             # Credential CRUD + cleanup loop
│   │   └── totp.go              # TOTP key lifecycle (init → pending → active)
│   ├── proxy/proxy.go           # HTTP/HTTPS proxy with auth gate
│   └── web/
│       ├── web.go               # REST API + embedded frontend serving
│       └── embed.go             # //go:embed all:dist
│           dist/                # Built by `make frontend` (gitignored)
│
└── frontend/                    # Bun + Vite + React + Tailwind SPA
    ├── src/
    │   ├── App.tsx              # Root; manages global status + TOTP code state
    │   ├── pages/
    │   │   ├── SetupPage.tsx    # Two-step TOTP setup (scan QR → verify)
    │   │   └── Dashboard.tsx    # Main credential management
    │   ├── components/
    │   │   ├── Logo.tsx         # Pixel-art SVG fairy logo
    │   │   ├── TOTPInput.tsx    # Six individual digit inputs with auto-advance
    │   │   ├── CredentialCard.tsx # Single credential with renew/delete
    │   │   └── QRModal.tsx      # TOTP QR share modal
    │   └── lib/utils.ts         # Shared types, API helper, formatting
    └── vite.config.ts           # Output → ../internal/web/dist
```

## Key invariants

- **Proxy auth** lives in `internal/proxy/proxy.go`. Authentication reads from
  `store.Authenticate(user, pass)` which only returns true for *active*
  (non-expired) credentials.

- **TOTP lifecycle** in `auth/totp.go`:
  - `TOTPStatus()` → `"none"` | `"pending"` | `"active"`
  - `none` → `InitTOTP()` generates + saves `data/totp_secret.pending`
  - `pending` → `ConfirmTOTP(code)` verifies + renames to `data/totp_secret`
  - `active` → `VerifyTOTP(code)` for all management actions

- **Credential retention**: `CleanAt = ExpiresAt + min(Duration, 24h)`.
  The cleanup goroutine runs every minute.

- **Frontend build pipeline**: `bun run build` inside `frontend/` outputs to
  `internal/web/dist/`. Go embeds this directory at compile time. If you change
  frontend code, run `make frontend` before `go build`.

- **API transport**: All management endpoints require `X-TOTP-Code` header.
  The `/api/totp/qr` endpoint also accepts `?code=` query param (GET).

## Adding a new API endpoint

1. Add handler method to `internal/web/web.go`
2. Register route in `ListenAndServe`
3. Add corresponding fetch call in `frontend/src/lib/utils.ts` or inline
4. Log the action with `slog.Info(...)` including relevant fields

## Adding a new frontend page/component

1. Create file under `frontend/src/pages/` or `frontend/src/components/`
2. Use `framer-motion` for enter/exit animations
3. Use `cn()` from `lib/utils` for conditional class merging
4. Access the API via `apiFetch<T>(method, path, body?, totpCode?)` from `lib/utils`

## Data files (runtime, not committed)

```
data/
├── totp_secret.pending   # TOTP secret before first verification
├── totp_secret           # Active TOTP secret (base32, one line)
└── credentials.json      # Array of Credential structs
```

## Build commands

```bash
make build      # frontend + Go binary
make dev        # parallel dev servers (Vite :5173 + Go :7070/:7071)
make release    # cross-compile for linux/darwin/windows
make clean      # remove build artifacts
```

## Go version and style

- Go 1.22+ (uses `http.ServeMux` pattern matching, `log/slog`)
- No global state outside `auth.Store`
- Errors wrapped with `fmt.Errorf("ctx: %w", err)`
- Structured logging via `log/slog` everywhere — no `fmt.Printf`

## Frontend conventions

- Tailwind utility classes only (no plain CSS except `src/index.css` base layer)
- Framer Motion for all transitions
- `type` imports for TypeScript type-only imports (verbatimModuleSyntax)
- `apiFetch` always used for HTTP — never raw `fetch` directly in components
