package config

import (
	"os"
	"strconv"
	"time"
)

const (
	defaultPort              = "8080"
	defaultStaticDir         = "./client"
	defaultReadHeaderTimeout = 5 * time.Second
	defaultReadTimeout       = 10 * time.Second
	defaultWriteTimeout      = 15 * time.Second
	defaultIdleTimeout       = 60 * time.Second
	defaultShutdownTimeout   = 10 * time.Second
)

// Config holds runtime settings for the HTTP server.
type Config struct {
	Port              string
	StaticDir         string
	ReadHeaderTimeout time.Duration
	ReadTimeout       time.Duration
	WriteTimeout      time.Duration
	IdleTimeout       time.Duration
	ShutdownTimeout   time.Duration
}

// Load reads environment variables and applies safe defaults.
func Load() Config {
	return Config{
		Port:              getEnv("PORT", defaultPort),
		StaticDir:         getEnv("STATIC_DIR", defaultStaticDir),
		ReadHeaderTimeout: getDurationFromMS("READ_HEADER_TIMEOUT_MS", defaultReadHeaderTimeout),
		ReadTimeout:       getDurationFromMS("READ_TIMEOUT_MS", defaultReadTimeout),
		WriteTimeout:      getDurationFromMS("WRITE_TIMEOUT_MS", defaultWriteTimeout),
		IdleTimeout:       getDurationFromMS("IDLE_TIMEOUT_MS", defaultIdleTimeout),
		ShutdownTimeout:   getDurationFromMS("SHUTDOWN_TIMEOUT_MS", defaultShutdownTimeout),
	}
}

func getEnv(key, fallback string) string {
	if value, ok := os.LookupEnv(key); ok && value != "" {
		return value
	}

	return fallback
}

func getDurationFromMS(key string, fallback time.Duration) time.Duration {
	value := getEnv(key, "")
	if value == "" {
		return fallback
	}

	milliseconds, err := strconv.Atoi(value)
	if err != nil || milliseconds <= 0 {
		return fallback
	}

	return time.Duration(milliseconds) * time.Millisecond
}
