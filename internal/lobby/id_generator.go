package lobby

import (
	"crypto/rand"
	"encoding/hex"
	"fmt"
)

// IDGenerator generates unique player IDs.
type IDGenerator interface {
	NewID() (string, error)
}

// CryptoIDGenerator uses secure random bytes and hex encoding.
type CryptoIDGenerator struct{}

func NewCryptoIDGenerator() *CryptoIDGenerator {
	return &CryptoIDGenerator{}
}

func (g *CryptoIDGenerator) NewID() (string, error) {
	raw := make([]byte, 16)
	if _, err := rand.Read(raw); err != nil {
		return "", fmt.Errorf("generate player id: %w", err)
	}

	return hex.EncodeToString(raw), nil
}
