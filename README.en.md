[🇨🇳 中文](README.md)

---

# 🧚 Pixey Proxy

> **Vibe coding product** — designed, written, and committed entirely by [Claude](https://claude.ai) (Anthropic).  
> A TOTP-guarded reverse proxy authenticator with a pixel-art fairy mascot.

[![MIT License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Go 1.22+](https://img.shields.io/badge/go-1.22%2B-00ADD8.svg)](https://go.dev)
[![Bun](https://img.shields.io/badge/bun-1.x-fbf0df.svg)](https://bun.sh)

---

## What it does

Pixey sits in front of an upstream HTTP/HTTPS proxy and adds its own
authentication layer:

```
Client ──[user:pass]──► Pixey Proxy ──[upstream creds]──► Upstream Proxy ──► Internet
                            │
                       Web UI :7071
                      (TOTP protected)
```

- **Reverse proxy** — forwards all traffic to a configured upstream proxy
- **Short-lived credentials** — generate user/password pairs valid 30 min → 7 days
- **TOTP admin UI** — Google Authenticator / Authy compatible; no passwords to remember
- **Zero runtime deps** — single self-contained binary with embedded frontend

---

## Quick start

### Option 1: Docker (recommended — no Go or Bun required)

**Prerequisites**: [Docker](https://docs.docker.com/get-docker/) and Docker Compose.

```bash
git clone <repo-url>
cd pixey
```

Edit `config.yaml` with your upstream proxy address:

```yaml
upstream:
  url: "http://host.docker.internal:8080"  # upstream on the host machine
  username: ""
  password: ""

proxy:
  addr: ":7070"
web:
  addr: ":7071"
```

> **Networking notes**
> - Upstream proxy on the **host machine**: use `host.docker.internal:<port>` (`extra_hosts` is already configured in `docker-compose.yml` for Linux)
> - Upstream proxy on a **remote server**: use its IP or hostname directly — no extra config needed
> - Need full host networking: set `network_mode: "host"` in `docker-compose.yml`

Start the service:

```bash
docker compose up -d
```

The image is built automatically on first run (~1–2 min). Then open **http://localhost:7071** to complete TOTP setup.

Credential data persists in the Docker volume `pixey-data` across restarts.

Useful commands:

```bash
docker compose logs -f          # stream live logs
docker compose restart          # restart (after editing config.yaml)
docker compose down             # stop and remove containers
docker compose down -v          # stop and wipe all data (irreversible)
```

---

### Option 2: Build from source

**Prerequisites**

| Tool | Version | Purpose |
|------|---------|---------|
| [Go](https://go.dev/dl/) | 1.22+ | Backend compiler |
| [Bun](https://bun.sh) | 1.x | Frontend build tool & package manager |
| `make` | any | Build orchestration |

```bash
git clone <repo-url>
cd pixey

# Install frontend deps and build everything
make build
```

This produces a single `./pixey` binary with the web UI embedded inside.

### Configure

Edit `config.yaml` before running:

```yaml
upstream:
  url: "http://your-upstream-proxy:8080"
  username: ""          # leave empty if upstream needs no auth
  password: ""

proxy:
  addr: ":7070"         # clients connect here

web:
  addr: ":7071"         # admin panel
```

### Run

```bash
./pixey
```

Open **http://localhost:7071** to complete TOTP setup, then use the generated
credentials with any HTTP proxy client pointed at `localhost:7070`.

---

## Build system

Pixey uses a two-step build: Vite compiles the React frontend into
`internal/web/dist/`, which Go then embeds via `//go:embed`.

```
frontend/  →  bun run build  →  internal/web/dist/  →  go build  →  ./pixey
```

### Make targets

| Command | Description |
|---------|-------------|
| `make build` | Build frontend + Go binary (production) |
| `make dev` | Parallel dev servers — Vite HMR on :5173, Go API on :7071 |
| `make frontend` | Rebuild frontend only |
| `make backend` | Rebuild Go binary only |
| `make release` | Cross-compile for Linux/macOS/Windows (amd64 + arm64) |
| `make clean` | Remove all build artefacts |
| `make deps` | Install/tidy all dependencies |

### Development mode

```bash
make dev
```

Starts two processes in parallel:
- **Go backend** on `:7070` (proxy) + `:7071` (API)
- **Vite dev server** on `:5173` with HMR — proxies `/api/*` to `:7071`

Browse to `http://localhost:5173` while developing.

### Cross-platform release

```bash
make release
```

Outputs binaries in `dist/` for:
- `pixey-linux-amd64`, `pixey-linux-arm64`
- `pixey-darwin-amd64`, `pixey-darwin-arm64`
- `pixey-windows-amd64.exe`

---

## Frontend stack

| Package | Role |
|---------|------|
| [React 19](https://react.dev) | UI framework |
| [Vite](https://vite.dev) + [Bun](https://bun.sh) | Build tool & package manager |
| [Tailwind CSS 3](https://tailwindcss.com) | Utility-first styling |
| [Framer Motion](https://motion.dev) | Animations |
| [Radix UI](https://radix-ui.com) | Accessible primitives |
| [Lucide React](https://lucide.dev) | Icons |

---

## Admin UI guide

### First run — TOTP setup

1. Visit `http://localhost:7071`
2. Scan the QR code with Google Authenticator or Authy
3. Enter the 6-digit code to confirm — setup is one-time only
4. You're in the dashboard

### Creating credentials

1. Enter your current TOTP code in the verification box
2. Click **+** next to "New Credential"
3. Pick a validity duration (30 min – 7 days)
4. Click **Create credential**

The generated username (5 letters) and password (9 alphanumeric chars) are
displayed and copyable.

### Renewing / deleting

Each credential card has **Renew** and **Delete** buttons. Both require a valid
TOTP code in the verification box.

### Sharing the QR code

Click the QR icon in the header (requires valid TOTP) to display the setup QR
code again — useful for adding Pixey to a second authenticator device.

---

## Proxy usage

Configure your client to use `localhost:7070` as an HTTP proxy with the
credentials you generated:

```bash
# curl example
curl -x http://username:password@localhost:7070 https://example.com

# environment variables
export http_proxy=http://username:password@localhost:7070
export https_proxy=http://username:password@localhost:7070
```

Pixey forwards requests to the upstream proxy; if the upstream requires
credentials, they are added automatically from `config.yaml`.

---

## Security notes

- TOTP secret stored in `data/totp_secret` (mode `0600`) — **back this up**
- All credential operations require a valid TOTP code (no session cookies)
- Expired credentials remain accessible for `min(validity, 1 day)` before deletion
- Unauthenticated proxy connections receive `407 Proxy Auth Required`

---

## License

[MIT](LICENSE) © Claude (Anthropic)

---

*This project is a vibe coding artifact — designed, written, and committed
entirely by an AI assistant as a demonstration of autonomous software creation.*
