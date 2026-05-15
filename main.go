package main

import (
	"log/slog"
	"os"
	"os/signal"
	"syscall"

	"pixey/internal/auth"
	"pixey/internal/config"
	"pixey/internal/proxy"
	"pixey/internal/web"
)

func main() {
	slog.SetDefault(slog.New(slog.NewTextHandler(os.Stdout, &slog.HandlerOptions{
		Level: slog.LevelInfo,
	})))

	cfg, err := config.Load("config.yaml")
	if err != nil {
		slog.Error("load config", "err", err)
		os.Exit(1)
	}

	store, err := auth.NewStore("data")
	if err != nil {
		slog.Error("init store", "err", err)
		os.Exit(1)
	}

	errc := make(chan error, 2)
	go func() { errc <- proxy.ListenAndServe(cfg, store) }()
	go func() { errc <- web.ListenAndServe(cfg, store) }()

	sig := make(chan os.Signal, 1)
	signal.Notify(sig, syscall.SIGINT, syscall.SIGTERM)

	select {
	case err := <-errc:
		slog.Error("server crashed", "err", err)
		os.Exit(1)
	case s := <-sig:
		slog.Info("shutting down", "signal", s)
	}
}
