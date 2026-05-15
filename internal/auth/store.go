package auth

import (
	"crypto/rand"
	"encoding/json"
	"fmt"
	"math/big"
	"os"
	"path/filepath"
	"sync"
	"time"
)

const (
	MaxDuration     = 7 * 24 * time.Hour
	DefaultDuration = 30 * time.Minute
	MaxRetention    = 24 * time.Hour
	// NeverExpires signals a credential that never expires.
	NeverExpires = -1 * time.Second
)

type Credential struct {
	ID        string        `json:"id"`
	Username  string        `json:"username"`
	Password  string        `json:"password"`
	Label     string        `json:"label,omitempty"`
	Duration  time.Duration `json:"duration"`
	CreatedAt time.Time     `json:"created_at"`
	ExpiresAt time.Time     `json:"expires_at"`
	CleanAt   time.Time     `json:"clean_at"`
	BytesUp   int64         `json:"bytes_up"`
	BytesDown int64         `json:"bytes_down"`
}

func (c *Credential) IsActive() bool {
	// Zero ExpiresAt means never-expiring
	return c.ExpiresAt.IsZero() || time.Now().Before(c.ExpiresAt)
}

func (c *Credential) IsNeverExpiring() bool {
	return c.ExpiresAt.IsZero()
}

type Store struct {
	mu          sync.RWMutex
	dir         string
	credentials []*Credential
}

func NewStore(dir string) (*Store, error) {
	if err := os.MkdirAll(dir, 0o700); err != nil {
		return nil, fmt.Errorf("create data dir: %w", err)
	}
	s := &Store{dir: dir}
	if err := s.load(); err != nil {
		return nil, err
	}
	go s.runCleanup()
	return s, nil
}

func (s *Store) load() error {
	data, err := os.ReadFile(filepath.Join(s.dir, "credentials.json"))
	if err != nil {
		if os.IsNotExist(err) {
			return nil
		}
		return fmt.Errorf("load credentials: %w", err)
	}
	return json.Unmarshal(data, &s.credentials)
}

func (s *Store) save() error {
	data, err := json.MarshalIndent(s.credentials, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(filepath.Join(s.dir, "credentials.json"), data, 0o600)
}

func (s *Store) runCleanup() {
	ticker := time.NewTicker(time.Minute)
	defer ticker.Stop()
	for range ticker.C {
		s.cleanup()
	}
}

func (s *Store) cleanup() {
	s.mu.Lock()
	defer s.mu.Unlock()

	now := time.Now()
	var kept []*Credential
	changed := false
	for _, c := range s.credentials {
		// Never-expiring credentials have zero CleanAt — skip cleanup
		if !c.CleanAt.IsZero() && now.After(c.CleanAt) {
			changed = true
		} else {
			kept = append(kept, c)
		}
	}
	if changed {
		s.credentials = kept
		_ = s.save()
	}
}

// Authenticate returns the credential ID and whether the username/password are valid.
func (s *Store) Authenticate(username, password string) (id string, ok bool) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	for _, c := range s.credentials {
		if c.Username == username && c.Password == password && c.IsActive() {
			return c.ID, true
		}
	}
	return "", false
}

// RevealPassword returns the plaintext password for a credential by ID.
func (s *Store) RevealPassword(id string) (string, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	for _, c := range s.credentials {
		if c.ID == id {
			return c.Password, nil
		}
	}
	return "", fmt.Errorf("credential not found")
}

// SetLabel updates the label for a credential.
func (s *Store) SetLabel(id, label string) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	for _, c := range s.credentials {
		if c.ID == id {
			c.Label = label
			return s.save()
		}
	}
	return fmt.Errorf("credential not found")
}

// AddTraffic accumulates proxy traffic bytes for a credential.
func (s *Store) AddTraffic(id string, up, down int64) {
	if up == 0 && down == 0 {
		return
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	for _, c := range s.credentials {
		if c.ID == id {
			c.BytesUp += up
			c.BytesDown += down
			_ = s.save()
			return
		}
	}
}

func (s *Store) CreateCredential(duration time.Duration) (*Credential, error) {
	neverExpires := duration == NeverExpires

	if !neverExpires {
		if duration <= 0 {
			duration = DefaultDuration
		}
		if duration > MaxDuration {
			duration = MaxDuration
		}
	}

	id, err := randStr(8, alphanumChars)
	if err != nil {
		return nil, err
	}
	username, err := randStr(5, lowerChars)
	if err != nil {
		return nil, err
	}
	password, err := randStr(9, alphanumChars)
	if err != nil {
		return nil, err
	}

	now := time.Now()
	c := &Credential{
		ID:        id,
		Username:  username,
		Password:  password,
		Duration:  duration,
		CreatedAt: now,
	}

	if neverExpires {
		// ExpiresAt and CleanAt remain zero — never cleaned up
		c.Duration = NeverExpires
	} else {
		retention := duration
		if retention > MaxRetention {
			retention = MaxRetention
		}
		c.ExpiresAt = now.Add(duration)
		c.CleanAt   = now.Add(duration + retention)
	}

	s.mu.Lock()
	defer s.mu.Unlock()
	s.credentials = append(s.credentials, c)
	return c, s.save()
}

func (s *Store) ListCredentials() []*Credential {
	s.mu.RLock()
	defer s.mu.RUnlock()
	result := make([]*Credential, len(s.credentials))
	copy(result, s.credentials)
	return result
}

func (s *Store) DeleteCredential(id string) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	for i, c := range s.credentials {
		if c.ID == id {
			s.credentials = append(s.credentials[:i], s.credentials[i+1:]...)
			return s.save()
		}
	}
	return fmt.Errorf("credential not found")
}

func (s *Store) RenewCredential(id string, duration time.Duration) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	for _, c := range s.credentials {
		if c.ID == id {
			neverExpires := duration == NeverExpires
			if !neverExpires {
				if duration <= 0 {
					duration = c.Duration
				}
				// Keep never-expiring if original was never-expiring and no new dur given
				if duration == NeverExpires {
					neverExpires = true
				} else if duration > MaxDuration {
					duration = MaxDuration
				}
			}

			now := time.Now()
			c.Duration = duration
			if neverExpires {
				c.ExpiresAt = time.Time{}
				c.CleanAt   = time.Time{}
			} else {
				retention := duration
				if retention > MaxRetention {
					retention = MaxRetention
				}
				c.ExpiresAt = now.Add(duration)
				c.CleanAt   = now.Add(duration + retention)
			}
			return s.save()
		}
	}
	return fmt.Errorf("credential not found")
}

const (
	lowerChars    = "abcdefghijklmnopqrstuvwxyz"
	alphanumChars = "abcdefghijklmnopqrstuvwxyz0123456789"
)

func randStr(length int, charset string) (string, error) {
	b := make([]byte, length)
	max := big.NewInt(int64(len(charset)))
	for i := range b {
		n, err := rand.Int(rand.Reader, max)
		if err != nil {
			return "", err
		}
		b[i] = charset[n.Int64()]
	}
	return string(b), nil
}
