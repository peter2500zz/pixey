package config

import (
	"fmt"
	"net/url"
	"os"

	"gopkg.in/yaml.v3"
)

type Config struct {
	Upstream UpstreamConfig `yaml:"upstream"`
	Proxy    ProxyConfig    `yaml:"proxy"`
	Web      WebConfig      `yaml:"web"`
}

type UpstreamConfig struct {
	URL      string `yaml:"url"`
	Username string `yaml:"username"`
	Password string `yaml:"password"`
}

type ProxyConfig struct {
	Addr string `yaml:"addr"`
}

type WebConfig struct {
	Addr string `yaml:"addr"`
}

func Load(path string) (*Config, error) {
	cfg := &Config{
		Proxy: ProxyConfig{Addr: ":7070"},
		Web:   WebConfig{Addr: ":7071"},
	}

	data, err := os.ReadFile(path)
	if err != nil {
		if os.IsNotExist(err) {
			return cfg, nil
		}
		return nil, fmt.Errorf("read config: %w", err)
	}

	if err := yaml.Unmarshal(data, cfg); err != nil {
		return nil, fmt.Errorf("parse config: %w", err)
	}
	if cfg.Proxy.Addr == "" {
		cfg.Proxy.Addr = ":7070"
	}
	if cfg.Web.Addr == "" {
		cfg.Web.Addr = ":7071"
	}
	return cfg, nil
}

func (c *Config) UpstreamURL() *url.URL {
	if c.Upstream.URL == "" {
		return nil
	}
	u, err := url.Parse(c.Upstream.URL)
	if err != nil {
		return nil
	}
	if c.Upstream.Username != "" {
		u.User = url.UserPassword(c.Upstream.Username, c.Upstream.Password)
	}
	return u
}
