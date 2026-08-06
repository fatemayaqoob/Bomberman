package lobby

import (
	"errors"
	"sync"
)

var ErrPlayerAlreadyExists = errors.New("player already exists")

// PlayerRepository stores current lobby players.
type PlayerRepository interface {
	Add(player Player) error
	Remove(playerID string)
	Count() int
}

// InMemoryPlayerRepository stores players in memory for stage-one lobby needs.
type InMemoryPlayerRepository struct {
	mu      sync.RWMutex
	players map[string]Player
}

func NewInMemoryPlayerRepository() *InMemoryPlayerRepository {
	return &InMemoryPlayerRepository{
		players: make(map[string]Player),
	}
}

func (r *InMemoryPlayerRepository) Add(player Player) error {
	r.mu.Lock()
	defer r.mu.Unlock()

	if _, exists := r.players[player.ID]; exists {
		return ErrPlayerAlreadyExists
	}

	r.players[player.ID] = player
	return nil
}

func (r *InMemoryPlayerRepository) Remove(playerID string) {
	r.mu.Lock()
	defer r.mu.Unlock()

	delete(r.players, playerID)
}

func (r *InMemoryPlayerRepository) Count() int {
	r.mu.RLock()
	defer r.mu.RUnlock()

	return len(r.players)
}
