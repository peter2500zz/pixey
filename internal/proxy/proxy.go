package proxy

import (
	"bufio"
	"bytes"
	"encoding/base64"
	"fmt"
	"io"
	"log"
	"log/slog"
	"net"
	"net/http"
	"strings"
	"sync"
	"sync/atomic"
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
	srv := &http.Server{
		Addr:     cfg.Proxy.Addr,
		Handler:  logged,
		ErrorLog: log.New(slogWriter{}, "", 0),
	}
	slog.Info("proxy listening", "addr", cfg.Proxy.Addr)
	return srv.ListenAndServe()
}

// slogWriter bridges http.Server.ErrorLog to slog.
type slogWriter struct{}

func (slogWriter) Write(p []byte) (int, error) {
	slog.Error("http server", "msg", strings.TrimSpace(string(p)))
	return len(p), nil
}

type statusWriter struct {
	http.ResponseWriter
	status int
}

func (sw *statusWriter) WriteHeader(code int) {
	sw.status = code
	sw.ResponseWriter.WriteHeader(code)
}

func (sw *statusWriter) Hijack() (net.Conn, *bufio.ReadWriter, error) {
	hj, ok := sw.ResponseWriter.(http.Hijacker)
	if !ok {
		return nil, nil, fmt.Errorf("ResponseWriter does not support hijacking")
	}
	return hj.Hijack()
}

func basicAuthUser(r *http.Request) string {
	u, _, ok := proxyBasicAuth(r)
	if !ok {
		return "-"
	}
	return u
}

type handler struct {
	cfg   *config.Config
	store *auth.Store
}

func (h *handler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	username, password, ok := proxyBasicAuth(r)
	credID, authed := h.store.Authenticate(username, password)
	if !ok || !authed {
		w.Header().Set("Proxy-Authenticate", `Basic realm="Pixey"`)
		w.Header().Set("Content-Type", "text/plain")
		w.WriteHeader(http.StatusProxyAuthRequired)
		fmt.Fprint(w, "407 Proxy Authentication Required")
		return
	}

	if r.Method == http.MethodConnect {
		h.handleConnect(w, r, credID)
	} else {
		h.handleHTTP(w, r, credID)
	}
}

func (h *handler) handleConnect(w http.ResponseWriter, r *http.Request, credID string) {
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

		// Drain any bytes already buffered from the upstream tunnel response.
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

	client, bufrw, err := hj.Hijack()
	if err != nil {
		upstream.Close()
		slog.Error("CONNECT hijack failed", "host", r.Host, "err", err)
		return
	}

	if _, err := io.WriteString(client, "HTTP/1.1 200 Connection Established\r\n\r\n"); err != nil {
		client.Close()
		upstream.Close()
		return
	}

	// Restore bytes the HTTP server buffered past the CONNECT request headers
	// (e.g. TLS ClientHello sent by a client that doesn't wait for the 200).
	var clientConn net.Conn = client
	if n := bufrw.Reader.Buffered(); n > 0 {
		peeked := make([]byte, n)
		bufrw.Reader.Read(peeked)
		clientConn = &prependConn{Conn: client, buf: bytes.NewReader(peeked)}
	}

	var up, down int64
	go func() {
		bidiTunnel(clientConn, upstream, &up, &down)
		h.store.AddTraffic(credID, atomic.LoadInt64(&up), atomic.LoadInt64(&down))
	}()
}

func (h *handler) handleHTTP(w http.ResponseWriter, r *http.Request, credID string) {
	upstreamURL := h.cfg.UpstreamURL()

	transport := &http.Transport{}
	if upstreamURL != nil {
		transport.Proxy = http.ProxyURL(upstreamURL)
	}

	out := r.Clone(r.Context())
	out.RequestURI = ""
	out.Header.Del("Proxy-Authorization")
	out.Header.Del("Proxy-Connection")

	var up, down int64
	if out.Body != nil {
		out.Body = &countReadCloser{rc: out.Body, n: &up}
	}

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
	io.Copy(w, &countReader{r: resp.Body, n: &down})

	h.store.AddTraffic(credID, up, down)
}

// bidiTunnel copies between a and b in both directions simultaneously.
// It uses TCP half-close (CloseWrite) so that when one side finishes sending,
// the other side receives a clean EOF instead of a RST.
func bidiTunnel(a, b net.Conn, aToB, bToA *int64) {
	var wg sync.WaitGroup
	wg.Add(2)
	go func() {
		defer wg.Done()
		io.Copy(b, &countReader{r: a, n: aToB})
		closeWrite(b)
	}()
	go func() {
		defer wg.Done()
		io.Copy(a, &countReader{r: b, n: bToA})
		closeWrite(a)
	}()
	wg.Wait()
	a.Close()
	b.Close()
}

// closeWrite signals EOF on the write side without closing the read side,
// falling back to a full Close when the connection doesn't support it.
func closeWrite(c net.Conn) {
	type halfCloser interface{ CloseWrite() error }
	if hc, ok := c.(halfCloser); ok {
		hc.CloseWrite()
	} else {
		c.Close()
	}
}

type countReader struct {
	r io.Reader
	n *int64
}

func (c *countReader) Read(b []byte) (int, error) {
	n, err := c.r.Read(b)
	atomic.AddInt64(c.n, int64(n))
	return n, err
}

type countReadCloser struct {
	rc io.ReadCloser
	n  *int64
}

func (c *countReadCloser) Read(b []byte) (int, error) {
	n, err := c.rc.Read(b)
	*c.n += int64(n)
	return n, err
}

func (c *countReadCloser) Close() error { return c.rc.Close() }

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

func (p *prependConn) CloseWrite() error {
	type halfCloser interface{ CloseWrite() error }
	if hc, ok := p.Conn.(halfCloser); ok {
		return hc.CloseWrite()
	}
	return p.Conn.Close()
}
