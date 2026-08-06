package httpserver

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"os"

	"bomberman-dom/internal/config"
)

// Server owns the HTTP transport for the backend foundation.
type Server struct {
	httpServer *http.Server
}

// New creates a configured HTTP server with static and websocket routes.
func New(cfg config.Config) (*Server, error) {
	if _, err := os.Stat(cfg.StaticDir); err != nil {
		return nil, fmt.Errorf("static dir check failed: %w", err)
	}

	lobbyHandler := newLobbyWSHandler()

	mux := http.NewServeMux()
	mux.HandleFunc("/ws", lobbyHandler.Handle)
	mux.Handle("/", staticHandler(cfg.StaticDir))

	httpSrv := &http.Server{
		Addr:              ":" + cfg.Port,
		Handler:           mux,
		ReadHeaderTimeout: cfg.ReadHeaderTimeout,
		ReadTimeout:       cfg.ReadTimeout,
		WriteTimeout:      cfg.WriteTimeout,
		IdleTimeout:       cfg.IdleTimeout,
	}

	return &Server{httpServer: httpSrv}, nil
}

func staticHandler(staticDir string) http.Handler {
	fileServer := http.FileServer(http.Dir(staticDir))

	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet && r.Method != http.MethodHead {
			writeHTTPError(w, http.StatusMethodNotAllowed, "method not allowed")
			return
		}

		fileServer.ServeHTTP(w, r)
	})
}

// Start begins serving HTTP requests.
func (s *Server) Start() error {
	err := s.httpServer.ListenAndServe()
	if errors.Is(err, http.ErrServerClosed) {
		return nil
	}

	return err
}

// Shutdown gracefully stops the HTTP server.
func (s *Server) Shutdown(ctx context.Context) error {
	return s.httpServer.Shutdown(ctx)
}
