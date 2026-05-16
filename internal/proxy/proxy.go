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
	"sync"
	"sync/atomic"
	"time"

	"pixey/internal/auth"
	"pixey/internal/config"
)

func ListenAndServe(cfg *config.Config, store *auth.Store) error {
	ln, err := net.Listen("tcp", cfg.Proxy.Addr)
	if err != nil {
		return fmt.Errorf("proxy listen: %w", err)
	}
	slog.Info("proxy listening", "addr", cfg.Proxy.Addr)
	for {
		conn, err := ln.Accept()
		if err != nil {
			return fmt.Errorf("proxy accept: %w", err)
		}
		go handleConn(conn, cfg, store)
	}
}

func handleConn(client net.Conn, cfg *config.Config, store *auth.Store) {
	defer client.Close()
	start := time.Now()

	br := bufio.NewReader(client)

	// Read the opening request — only to extract Proxy-Authorization.
	req, err := http.ReadRequest(br)
	if err != nil {
		return
	}

	username, password, ok := decodeBasicAuth(req.Header.Get("Proxy-Authorization"))
	credID, authed := store.Authenticate(username, password)
	if !ok || !authed {
		fmt.Fprintf(client,
			"HTTP/1.1 407 Proxy Authentication Required\r\n"+
				"Proxy-Authenticate: Basic realm=\"Pixey\"\r\n"+
				"Content-Length: 0\r\n\r\n")
		slog.Info("proxy", "method", req.Method, "host", req.Host,
			"status", 407, "user", username,
			"ms", time.Since(start).Milliseconds())
		return
	}

	upstreamURL := cfg.UpstreamURL()

	var upstream net.Conn
	if upstreamURL != nil {
		// ── Forwarding mode ────────────────────────────────────────────────
		// Connect to the upstream proxy and hand it the (auth-swapped) request.
		// From this point we never inspect another byte.
		addr := upstreamURL.Host
		if upstreamURL.Port() == "" {
			if upstreamURL.Scheme == "https" {
				addr += ":443"
			} else {
				addr += ":80"
			}
		}
		upstream, err = net.Dial("tcp", addr)
		if err != nil {
			fmt.Fprintf(client, "HTTP/1.1 502 Bad Gateway\r\nContent-Length: 0\r\n\r\n")
			slog.Error("proxy upstream dial", "addr", addr, "err", err)
			return
		}

		// Swap credentials: strip Pixey's, inject upstream's (if any).
		req.Header.Del("Proxy-Authorization")
		if upstreamURL.User != nil {
			pass, _ := upstreamURL.User.Password()
			enc := base64.StdEncoding.EncodeToString(
				[]byte(upstreamURL.User.Username() + ":" + pass))
			req.Header.Set("Proxy-Authorization", "Basic "+enc)
		}

		if err := req.WriteProxy(upstream); err != nil {
			upstream.Close()
			return
		}
	} else {
		// ── Direct mode (no upstream proxy) ────────────────────────────────
		// For CONNECT we dial the target and send 200 to the client ourselves.
		// For plain HTTP we dial the target and forward the request directly.
		// This is the only place where method matters, and only in this fallback.
		if req.Method == http.MethodConnect {
			upstream, err = net.Dial("tcp", req.Host)
			if err != nil {
				fmt.Fprintf(client, "HTTP/1.1 502 Bad Gateway\r\nContent-Length: 0\r\n\r\n")
				return
			}
			fmt.Fprintf(client, "HTTP/1.1 200 Connection Established\r\n\r\n")
		} else {
			host := req.URL.Hostname()
			port := req.URL.Port()
			if port == "" {
				port = "80"
			}
			upstream, err = net.Dial("tcp", host+":"+port)
			if err != nil {
				fmt.Fprintf(client, "HTTP/1.1 502 Bad Gateway\r\nContent-Length: 0\r\n\r\n")
				return
			}
			req.Header.Del("Proxy-Authorization")
			req.Header.Del("Proxy-Connection")
			req.Close = true
			if err := req.Write(upstream); err != nil {
				upstream.Close()
				return
			}
		}
	}
	defer upstream.Close()

	slog.Info("proxy", "method", req.Method, "host", req.Host,
		"status", 200, "user", username,
		"ms", time.Since(start).Milliseconds())

	// Drain bytes the bufio read ahead beyond the request headers/body.
	var clientConn net.Conn = client
	if n := br.Buffered(); n > 0 {
		peeked := make([]byte, n)
		br.Read(peeked)
		clientConn = &prependConn{Conn: client, buf: bytes.NewReader(peeked)}
	}

	// Pure TCP relay — no further inspection regardless of protocol.
	var up, down int64
	bidiTunnel(clientConn, upstream, &up, &down)
	store.AddTraffic(credID, atomic.LoadInt64(&up), atomic.LoadInt64(&down))
}

// bidiTunnel copies between a and b in both directions with half-close so
// each side receives a clean EOF rather than a RST when the other side stops.
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

func decodeBasicAuth(val string) (user, pass string, ok bool) {
	const prefix = "Basic "
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

// prependConn serves buffered bytes before the underlying connection.
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
