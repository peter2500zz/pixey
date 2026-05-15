package proxy

import (
	"bufio"
	"bytes"
	"encoding/base64"
	"fmt"
	"io"
	"log/slog"
	"net"
	"net/http"
	"strings"
	"time"

	"pixey/internal/auth"
	"pixey/internal/config"
)

func ListenAndServe(cfg *config.Config, store *auth.Store) error {
	h := &handler{cfg: cfg, store: store}
	logged := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()
		lw := &statusWriter{ResponseWriter: w, status: 200}
		h.ServeHTTP(lw, r)
		slog.Info("proxy", "method", r.Method, "host", r.Host,
			"status", lw.status, "user", basicAuthUser(r),
			"ms", time.Since(start).Milliseconds())
	})
	srv := &http.Server{Addr: cfg.Proxy.Addr, Handler: logged}
	slog.Info("proxy listening", "addr", cfg.Proxy.Addr)
	return srv.ListenAndServe()
}

type statusWriter struct {
	http.ResponseWriter
	status int
}

func (sw *statusWriter) WriteHeader(code int) {
	sw.status = code
	sw.ResponseWriter.WriteHeader(code)
}

func basicAuthUser(r *http.Request) string {
	u, _, ok := proxyBasicAuth(r)
	if !ok { return "-" }
	return u
}

type handler struct {
	cfg   *config.Config
	store *auth.Store
}

func (h *handler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	username, password, ok := proxyBasicAuth(r)
	if !ok || !h.store.Authenticate(username, password) {
		w.Header().Set("Proxy-Authenticate", `Basic realm="Pixey"`)
		w.Header().Set("Content-Type", "text/plain")
		w.WriteHeader(http.StatusProxyAuthRequired)
		fmt.Fprint(w, "407 Proxy Authentication Required")
		return
	}

	if r.Method == http.MethodConnect {
		h.handleConnect(w, r)
	} else {
		h.handleHTTP(w, r)
	}
}

func (h *handler) handleConnect(w http.ResponseWriter, r *http.Request) {
	upstreamURL := h.cfg.UpstreamURL()

	var upstream net.Conn
	var err error

	if upstreamURL != nil {
		upstreamAddr := upstreamURL.Host
		if upstreamURL.Port() == "" {
			switch upstreamURL.Scheme {
			case "https":
				upstreamAddr += ":443"
			default:
				upstreamAddr += ":80"
			}
		}

		upstream, err = net.Dial("tcp", upstreamAddr)
		if err != nil {
			http.Error(w, "upstream unreachable: "+err.Error(), http.StatusBadGateway)
			return
		}

		connectLine := fmt.Sprintf("CONNECT %s HTTP/1.1\r\nHost: %s\r\n", r.Host, r.Host)
		if upstreamURL.User != nil {
			password, _ := upstreamURL.User.Password()
			creds := base64.StdEncoding.EncodeToString([]byte(upstreamURL.User.Username() + ":" + password))
			connectLine += "Proxy-Authorization: Basic " + creds + "\r\n"
		}
		connectLine += "\r\n"

		if _, err := io.WriteString(upstream, connectLine); err != nil {
			upstream.Close()
			http.Error(w, "upstream write failed", http.StatusBadGateway)
			return
		}

		br := bufio.NewReaderSize(upstream, 4096)
		resp, err := http.ReadResponse(br, nil)
		if err != nil {
			upstream.Close()
			http.Error(w, "upstream response error: "+err.Error(), http.StatusBadGateway)
			return
		}
		resp.Body.Close()
		if resp.StatusCode != http.StatusOK {
			upstream.Close()
			http.Error(w, "upstream tunnel rejected: "+resp.Status, http.StatusBadGateway)
			return
		}

		// Drain any data already buffered from the tunnel
		if n := br.Buffered(); n > 0 {
			buffered := make([]byte, n)
			br.Read(buffered)
			upstream = &prependConn{Conn: upstream, buf: bytes.NewReader(buffered)}
		}
	} else {
		upstream, err = net.Dial("tcp", r.Host)
		if err != nil {
			http.Error(w, "connection failed: "+err.Error(), http.StatusBadGateway)
			return
		}
	}

	hj, ok := w.(http.Hijacker)
	if !ok {
		upstream.Close()
		http.Error(w, "hijack unsupported", http.StatusInternalServerError)
		return
	}

	client, _, err := hj.Hijack()
	if err != nil {
		upstream.Close()
		http.Error(w, "hijack failed", http.StatusInternalServerError)
		return
	}

	io.WriteString(client, "HTTP/1.1 200 Connection Established\r\n\r\n")

	go tunnel(upstream, client)
	go tunnel(client, upstream)
}

func (h *handler) handleHTTP(w http.ResponseWriter, r *http.Request) {
	upstreamURL := h.cfg.UpstreamURL()

	transport := &http.Transport{}
	if upstreamURL != nil {
		transport.Proxy = http.ProxyURL(upstreamURL)
	}

	out := r.Clone(r.Context())
	out.RequestURI = ""
	out.Header.Del("Proxy-Authorization")
	out.Header.Del("Proxy-Connection")

	resp, err := (&http.Client{
		Transport: transport,
		CheckRedirect: func(_ *http.Request, _ []*http.Request) error {
			return http.ErrUseLastResponse
		},
	}).Do(out)
	if err != nil {
		http.Error(w, "upstream error: "+err.Error(), http.StatusBadGateway)
		return
	}
	defer resp.Body.Close()

	hdr := w.Header()
	for k, vv := range resp.Header {
		for _, v := range vv {
			hdr.Add(k, v)
		}
	}
	w.WriteHeader(resp.StatusCode)
	io.Copy(w, resp.Body)
}

func tunnel(dst, src net.Conn) {
	defer dst.Close()
	defer src.Close()
	io.Copy(dst, src)
}

func proxyBasicAuth(r *http.Request) (string, string, bool) {
	const prefix = "Basic "
	val := r.Header.Get("Proxy-Authorization")
	if !strings.HasPrefix(val, prefix) {
		return "", "", false
	}
	decoded, err := base64.StdEncoding.DecodeString(val[len(prefix):])
	if err != nil {
		return "", "", false
	}
	parts := strings.SplitN(string(decoded), ":", 2)
	if len(parts) != 2 {
		return "", "", false
	}
	return parts[0], parts[1], true
}

// prependConn wraps a net.Conn and serves buffered bytes before the real conn.
type prependConn struct {
	net.Conn
	buf *bytes.Reader
}

func (p *prependConn) Read(b []byte) (int, error) {
	if p.buf.Len() > 0 {
		return p.buf.Read(b)
	}
	return p.Conn.Read(b)
}
