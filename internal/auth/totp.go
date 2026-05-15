package auth

import (
	"bytes"
	"encoding/base64"
	"fmt"
	"image/png"
	"net/url"
	"os"
	"path/filepath"
	"strings"

	"github.com/pquerna/otp"
	"github.com/pquerna/otp/totp"
)

func (s *Store) TOTPStatus() string {
	if _, err := os.Stat(filepath.Join(s.dir, "totp_secret")); err == nil {
		return "active"
	}
	if _, err := os.Stat(filepath.Join(s.dir, "totp_secret.pending")); err == nil {
		return "pending"
	}
	return "none"
}

// InitTOTP returns the QR code (as base64 PNG) and the raw secret for display.
// It creates and saves a pending secret on the first call.
func (s *Store) InitTOTP() (qrBase64 string, secret string, err error) {
	pendingPath := filepath.Join(s.dir, "totp_secret.pending")

	// Load or generate
	var key *otp.Key
	if data, readErr := os.ReadFile(pendingPath); readErr == nil {
		secret = strings.TrimSpace(string(data))
		key, err = keyFromSecret(secret)
	} else {
		key, err = totp.Generate(totp.GenerateOpts{
			Issuer:      "Pixey",
			AccountName: "admin",
		})
		if err == nil {
			secret = key.Secret()
			err = os.WriteFile(pendingPath, []byte(secret), 0o600)
		}
	}
	if err != nil {
		return "", "", fmt.Errorf("init TOTP: %w", err)
	}

	img, err := key.Image(256, 256)
	if err != nil {
		return "", "", fmt.Errorf("generate QR image: %w", err)
	}

	var buf bytes.Buffer
	if err := png.Encode(&buf, img); err != nil {
		return "", "", fmt.Errorf("encode QR image: %w", err)
	}

	return base64.StdEncoding.EncodeToString(buf.Bytes()), formatSecret(secret), nil
}

// ConfirmTOTP verifies the code against the pending secret and activates it.
func (s *Store) ConfirmTOTP(code string) error {
	pendingPath := filepath.Join(s.dir, "totp_secret.pending")
	activePath := filepath.Join(s.dir, "totp_secret")

	data, err := os.ReadFile(pendingPath)
	if err != nil {
		return fmt.Errorf("no pending TOTP setup")
	}

	secret := strings.TrimSpace(string(data))
	if !totp.Validate(code, secret) {
		return fmt.Errorf("invalid TOTP code")
	}

	return os.Rename(pendingPath, activePath)
}

// VerifyTOTP checks a code against the active secret.
func (s *Store) VerifyTOTP(code string) bool {
	data, err := os.ReadFile(filepath.Join(s.dir, "totp_secret"))
	if err != nil {
		return false
	}
	return totp.Validate(code, strings.TrimSpace(string(data)))
}

// GetActiveTOTP returns the QR code and secret for the active (verified) TOTP key.
func (s *Store) GetActiveTOTP() (qrBase64 string, secret string, err error) {
	data, readErr := os.ReadFile(filepath.Join(s.dir, "totp_secret"))
	if readErr != nil {
		return "", "", fmt.Errorf("TOTP not configured")
	}
	secret = strings.TrimSpace(string(data))
	key, err := keyFromSecret(secret)
	if err != nil {
		return "", "", err
	}

	img, err := key.Image(256, 256)
	if err != nil {
		return "", "", fmt.Errorf("generate QR image: %w", err)
	}

	var buf bytes.Buffer
	if err := png.Encode(&buf, img); err != nil {
		return "", "", fmt.Errorf("encode QR image: %w", err)
	}

	return base64.StdEncoding.EncodeToString(buf.Bytes()), formatSecret(secret), nil
}

func keyFromSecret(secret string) (*otp.Key, error) {
	rawURL := fmt.Sprintf(
		"otpauth://totp/Pixey:admin?secret=%s&issuer=Pixey&algorithm=SHA1&digits=6&period=30",
		url.QueryEscape(secret),
	)
	return otp.NewKeyFromURL(rawURL)
}

// formatSecret inserts spaces every 4 chars for readability.
func formatSecret(s string) string {
	var out strings.Builder
	for i, c := range s {
		if i > 0 && i%4 == 0 {
			out.WriteByte(' ')
		}
		out.WriteRune(c)
	}
	return out.String()
}
