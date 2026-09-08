package app

import (
	"context"
	"time"

	"bomberman-dom/internal/config"
	"bomberman-dom/internal/httpserver"
)

// App coordinates startup and shutdown for transport layers.
type App struct {
	server          *httpserver.Server
	shutdownTimeout time.Duration
}

// New wires dependencies for the current foundation server.
func New(cfg config.Config) (*App, error) {
	srv, err := httpserver.New(cfg)
	if err != nil {
		return nil, err
	}

	return &App{
		server:          srv,
		shutdownTimeout: cfg.ShutdownTimeout,
	}, nil
}

// Start blocks while the HTTP server is running.
func (a *App) Start() error {
	return a.server.Start()
}

// Shutdown gracefully stops the server with a timeout.
func (a *App) Shutdown(ctx context.Context) error {
	timeoutCtx, cancel := context.WithTimeout(ctx, a.shutdownTimeout)
	defer cancel()

	return a.server.Shutdown(timeoutCtx)
}
