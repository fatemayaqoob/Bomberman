package main

import (
	"context"
	"log"
	"os/signal"
	"syscall"

	"bomberman-dom/internal/app"
	"bomberman-dom/internal/config"
)

func main() {
	cfg := config.Load()

	application, err := app.New(cfg)
	if err != nil {
		log.Fatalf("failed to initialize app: %v", err)
	}

	shutdownCtx, stop := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer stop()

	go func() {
		<-shutdownCtx.Done()
		if err := application.Shutdown(context.Background()); err != nil {
			log.Printf("graceful shutdown failed: %v", err)
		}
	}()

	log.Printf("server running at http://localhost:%s", cfg.Port)
	if err := application.Start(); err != nil {
		log.Fatalf("server stopped with error: %v", err)
	}

	log.Printf("server stopped")
}
