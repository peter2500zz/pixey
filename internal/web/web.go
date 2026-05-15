package web

import (
	"encoding/json"
	"fmt"
	"io/fs"
	"log/slog"
	"net/http"
	"time"

	"pixey/internal/auth"
	"pixey/internal/config"
)

// publicCred is the credential shape sent to clients — password is omitted.
type publicCred struct {
	ID        string        `json:"id"`
	Username  string        `json:"username"`
	Label     string        `json:"label,omitempty"`
	Duration  time.Duration `json:"duration"`
	CreatedAt time.Time     `json:"created_at"`
	ExpiresAt time.Time     `json:"expires_at"`
	CleanAt   time.Time     `json:"clean_at"`
	BytesUp   int64         `json:"bytes_up"`
	BytesDown int64         `json:"bytes_down"`
}

func toPublic(c *auth.Credential) publicCred {
	return publicCred{
		ID:        c.ID,
		Username:  c.Username,
		Label:     c.Label,
		Duration:  c.Duration,
		CreatedAt: c.CreatedAt,
		ExpiresAt: c.ExpiresAt,
		CleanAt:   c.CleanAt,
		BytesUp:   c.BytesUp,
		BytesDown: c.BytesDown,
	}
}

func ListenAndServe(cfg *config.Config, store *auth.Store) error {
	mux := http.NewServeMux()
	h := &handler{cfg: cfg, store: store}

	// API routes
	mux.HandleFunc("GET /api/status", h.apiStatus)
	mux.HandleFunc("POST /api/setup", h.apiSetup)
	mux.HandleFunc("POST /api/credentials", h.apiCreateCredential)
	mux.HandleFunc("GET /api/credentials/{id}/password", h.apiRevealPassword)
	mux.HandleFunc("PUT /api/credentials/{id}/label", h.apiSetLabel)
	mux.HandleFunc("DELETE /api/credentials/{id}", h.apiDeleteCredential)
	mux.HandleFunc("PUT /api/credentials/{id}/renew", h.apiRenewCredential)
	mux.HandleFunc("GET /api/totp/qr", h.apiTOTPQR)

	// Serve embedded frontend (everything else)
	sub, err := fs.Sub(distFS, "dist")
	if err != nil {
		return fmt.Errorf("embed sub: %w", err)
	}
	fileServer := http.FileServer(http.FS(sub))
	mux.Handle("/", http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// SPA fallback: serve index.html for non-asset paths
		_, statErr := fs.Stat(sub, r.URL.Path[1:])
		if r.URL.Path != "/" && statErr != nil {
			r2 := *r
			r2.URL.Path = "/"
			fileServer.ServeHTTP(w, &r2)
			return
		}
		fileServer.ServeHTTP(w, r)
	}))

	logged := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		lw := &logWriter{ResponseWriter: w, status: 200}
		start := time.Now()
		mux.ServeHTTP(lw, r)
		slog.Info("web", "method", r.Method, "path", r.URL.Path,
			"status", lw.status, "ms", time.Since(start).Milliseconds())
	})

	slog.Info("web listening", "addr", cfg.Web.Addr)
	return http.ListenAndServe(cfg.Web.Addr, logged)
}

type handler struct {
	cfg   *config.Config
	store *auth.Store
}

func (h *handler) apiStatus(w http.ResponseWriter, r *http.Request) {
	status := h.store.TOTPStatus()
	resp := map[string]any{
		"totp_status": status,
		"proxy_addr":  h.cfg.Proxy.Addr,
	}

	if status == "active" {
		creds := h.store.ListCredentials()
		pub := make([]publicCred, len(creds))
		for i, c := range creds {
			pub[i] = toPublic(c)
		}
		resp["credentials"] = pub
	} else {
		qr, secret, err := h.store.InitTOTP()
		if err != nil {
			jsonError(w, err.Error(), http.StatusInternalServerError)
			return
		}
		resp["qr_code"] = qr
		resp["totp_secret"] = secret
	}

	jsonOK(w, resp)
}

func (h *handler) apiSetup(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Code string `json:"code"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.Code == "" {
		jsonError(w, "code required", http.StatusBadRequest)
		return
	}
	if err := h.store.ConfirmTOTP(req.Code); err != nil {
		slog.Warn("TOTP setup failed", "err", err)
		jsonError(w, err.Error(), http.StatusUnauthorized)
		return
	}
	slog.Info("TOTP setup complete")
	jsonOK(w, map[string]string{"message": "setup complete"})
}

func (h *handler) totpFromRequest(r *http.Request) bool {
	return h.store.VerifyTOTP(r.Header.Get("X-TOTP-Code"))
}

func (h *handler) apiCreateCredential(w http.ResponseWriter, r *http.Request) {
	if !h.totpFromRequest(r) {
		slog.Warn("create credential: invalid TOTP", "ip", r.RemoteAddr)
		jsonError(w, "invalid TOTP code", http.StatusUnauthorized)
		return
	}

	var req struct {
		Duration string `json:"duration"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		jsonError(w, "invalid request body", http.StatusBadRequest)
		return
	}

	duration, err := parseDuration(req.Duration)
	if err != nil {
		jsonError(w, err.Error(), http.StatusBadRequest)
		return
	}

	cred, err := h.store.CreateCredential(duration)
	if err != nil {
		jsonError(w, err.Error(), http.StatusInternalServerError)
		return
	}
	slog.Info("credential created", "user", cred.Username, "expires_at", cred.ExpiresAt)
	// Return full credential (with password) only on creation, for immediate display.
	jsonOK(w, cred)
}

func (h *handler) apiRevealPassword(w http.ResponseWriter, r *http.Request) {
	code := r.Header.Get("X-TOTP-Code")
	if code == "" {
		code = r.URL.Query().Get("code")
	}
	if !h.store.VerifyTOTP(code) {
		slog.Warn("reveal password: invalid TOTP", "ip", r.RemoteAddr)
		jsonError(w, "invalid TOTP code", http.StatusUnauthorized)
		return
	}
	id := r.PathValue("id")
	password, err := h.store.RevealPassword(id)
	if err != nil {
		jsonError(w, err.Error(), http.StatusNotFound)
		return
	}
	slog.Info("password revealed", "id", id, "ip", r.RemoteAddr)
	jsonOK(w, map[string]string{"password": password})
}

func (h *handler) apiSetLabel(w http.ResponseWriter, r *http.Request) {
	if !h.totpFromRequest(r) {
		slog.Warn("set label: invalid TOTP", "ip", r.RemoteAddr)
		jsonError(w, "invalid TOTP code", http.StatusUnauthorized)
		return
	}
	var req struct {
		Label string `json:"label"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		jsonError(w, "invalid request body", http.StatusBadRequest)
		return
	}
	id := r.PathValue("id")
	if err := h.store.SetLabel(id, req.Label); err != nil {
		jsonError(w, err.Error(), http.StatusNotFound)
		return
	}
	slog.Info("credential label set", "id", id, "label", req.Label)
	jsonOK(w, map[string]string{"message": "label updated"})
}

func (h *handler) apiDeleteCredential(w http.ResponseWriter, r *http.Request) {
	if !h.totpFromRequest(r) {
		slog.Warn("delete credential: invalid TOTP", "ip", r.RemoteAddr)
		jsonError(w, "invalid TOTP code", http.StatusUnauthorized)
		return
	}
	id := r.PathValue("id")
	if err := h.store.DeleteCredential(id); err != nil {
		jsonError(w, err.Error(), http.StatusNotFound)
		return
	}
	slog.Info("credential deleted", "id", id)
	jsonOK(w, map[string]string{"message": "deleted"})
}

func (h *handler) apiRenewCredential(w http.ResponseWriter, r *http.Request) {
	if !h.totpFromRequest(r) {
		slog.Warn("renew credential: invalid TOTP", "ip", r.RemoteAddr)
		jsonError(w, "invalid TOTP code", http.StatusUnauthorized)
		return
	}

	var req struct {
		Duration string `json:"duration"`
	}
	json.NewDecoder(r.Body).Decode(&req)

	var duration time.Duration
	if req.Duration != "" {
		d, err := parseDuration(req.Duration)
		if err != nil {
			jsonError(w, err.Error(), http.StatusBadRequest)
			return
		}
		duration = d
	}

	id := r.PathValue("id")
	if err := h.store.RenewCredential(id, duration); err != nil {
		jsonError(w, err.Error(), http.StatusNotFound)
		return
	}
	slog.Info("credential renewed", "id", id)
	jsonOK(w, map[string]string{"message": "renewed"})
}

func (h *handler) apiTOTPQR(w http.ResponseWriter, r *http.Request) {
	// Code can be in header or query param (for GET convenience)
	code := r.Header.Get("X-TOTP-Code")
	if code == "" {
		code = r.URL.Query().Get("code")
	}
	if !h.store.VerifyTOTP(code) {
		slog.Warn("TOTP QR access: invalid code", "ip", r.RemoteAddr)
		jsonError(w, "invalid TOTP code", http.StatusUnauthorized)
		return
	}

	qr, secret, err := h.store.GetActiveTOTP()
	if err != nil {
		jsonError(w, err.Error(), http.StatusInternalServerError)
		return
	}
	slog.Info("TOTP QR shared", "ip", r.RemoteAddr)
	jsonOK(w, map[string]string{"qr_code": qr, "totp_secret": secret})
}

func parseDuration(s string) (time.Duration, error) {
	if s == "" {
		return auth.DefaultDuration, nil
	}
	if s == "never" {
		return auth.NeverExpires, nil
	}
	if len(s) > 1 && s[len(s)-1] == 'd' {
		var n int
		if _, err := fmt.Sscanf(s[:len(s)-1], "%d", &n); err != nil || n <= 0 {
			return 0, fmt.Errorf("invalid duration: %s", s)
		}
		return time.Duration(n) * 24 * time.Hour, nil
	}
	d, err := time.ParseDuration(s)
	if err != nil {
		return 0, fmt.Errorf("invalid duration: %s", s)
	}
	return d, nil
}

func jsonOK(w http.ResponseWriter, v any) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(v)
}

func jsonError(w http.ResponseWriter, msg string, code int) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(code)
	json.NewEncoder(w).Encode(map[string]string{"error": msg})
}

type logWriter struct {
	http.ResponseWriter
	status int
}

func (lw *logWriter) WriteHeader(code int) {
	lw.status = code
	lw.ResponseWriter.WriteHeader(code)
}
