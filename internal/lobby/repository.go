package lobby

import (
	"errors"
	"strings"
	"sync"
)

// MinPlayers and MaxPlayers bound the size of a Bomberman match.
const (
	MinPlayers = 2
	MaxPlayers = 4
)

var (
	ErrPlayerAlreadyExists = errors.New("player already exists")
	ErrLobbyFull           = errors.New("lobby is full")
	ErrNicknameTaken       = errors.New("nickname already taken")
)

// PlayerRepository stores current lobby players.
type PlayerRepository interface {
	Add(player Player) error
	Remove(playerID string)
	Count() int
	List() []Player
}

// InMemoryPlayerRepository stores players in memory for stage-one lobby needs.
type InMemoryPlayerRepository struct {
	mu      sync.RWMutex
	players map[string]Player
	order   []string
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

	if len(r.players) >= MaxPlayers {
		return ErrLobbyFull
	}

	normalized := strings.ToLower(player.Nickname)
	for _, existing := range r.players {
		if strings.ToLower(existing.Nickname) == normalized {
			return ErrNicknameTaken
		}
	}

	r.players[player.ID] = player
	r.order = append(r.order, player.ID)
	return nil
}

func (r *InMemoryPlayerRepository) Remove(playerID string) {
	r.mu.Lock()
	defer r.mu.Unlock()

	if _, exists := r.players[playerID]; !exists {
		return
	}

	delete(r.players, playerID)
	for i, id := range r.order {
		if id == playerID {
			r.order = append(r.order[:i], r.order[i+1:]...)
			break
		}
	}
}

func (r *InMemoryPlayerRepository) Count() int {
	r.mu.RLock()
	defer r.mu.RUnlock()

	return len(r.players)
}

// List returns players in join order, giving a stable view for broadcasts.
func (r *InMemoryPlayerRepository) List() []Player {
	r.mu.RLock()
	defer r.mu.RUnlock()

	players := make([]Player, 0, len(r.order))
	for _, id := range r.order {
		players = append(players, r.players[id])
	}

	return players
}
