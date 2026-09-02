package game

import "sync"

// spawnPoints hands new players a deterministic starting position based on
// join order, spaced out so up to 4 players don't stack on each other.
// Real map-aware spawn placement belongs to a later game-rules task.
var spawnPoints = [][2]float64{
	{1, 1},
	{13, 1},
	{1, 11},
	{13, 11},
}

// State is the authoritative, concurrency-safe registry of connected
// players' synchronization state (position + basic state). All access
// funnels through a single mutex, so joins/leaves/moves can never race
// each other or produce a torn snapshot.
type State struct {
	mu      sync.Mutex
	players map[string]*Player
	order   []string
}

// NewState creates an empty synchronization state.
func NewState() *State {
	return &State{players: make(map[string]*Player)}
}

// Join registers a player at a deterministic spawn point and returns the
// created Player. Re-joining an existing ID resets its spawn.
func (s *State) Join(id, nickname string) Player {
	s.mu.Lock()
	defer s.mu.Unlock()

	if _, exists := s.players[id]; !exists {
		s.order = append(s.order, id)
	}

	spawn := spawnPoints[(len(s.order)-1)%len(spawnPoints)]
	player := &Player{
		ID:        id,
		Nickname:  nickname,
		X:         spawn[0],
		Y:         spawn[1],
		Direction: DirectionIdle,
		Alive:     true,
	}
	s.players[id] = player

	return *player
}

// Leave removes a player from the synchronization state.
func (s *State) Leave(id string) {
	s.mu.Lock()
	defer s.mu.Unlock()

	if _, exists := s.players[id]; !exists {
		return
	}

	delete(s.players, id)
	for i, existing := range s.order {
		if existing == id {
			s.order = append(s.order[:i], s.order[i+1:]...)
			break
		}
	}
}

// UpdatePosition updates a connected player's position/direction. It
// returns false (no-op) if the player isn't registered, e.g. a stale
// message arriving right after disconnect.
func (s *State) UpdatePosition(id string, x, y float64, direction Direction) bool {
	s.mu.Lock()
	defer s.mu.Unlock()

	player, exists := s.players[id]
	if !exists {
		return false
	}

	player.X = x
	player.Y = y
	player.Direction = direction

	return true
}

// Snapshot returns all connected players in join order, safe to broadcast.
func (s *State) Snapshot() []Player {
	s.mu.Lock()
	defer s.mu.Unlock()

	players := make([]Player, 0, len(s.order))
	for _, id := range s.order {
		players = append(players, *s.players[id])
	}

	return players
}
