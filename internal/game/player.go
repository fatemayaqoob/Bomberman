// Package game holds the authoritative multiplayer synchronization state:
// connected players' positions and basic state. It is intentionally kept
// independent from the Lobby (matchmaking) and Chat domains so it can grow
// into full game rules (bombs, powerups, combat) later without entangling
// those modules.
package game

// Direction is the facing/last-movement direction of a player avatar.
type Direction string

const (
	DirectionUp    Direction = "up"
	DirectionDown  Direction = "down"
	DirectionLeft  Direction = "left"
	DirectionRight Direction = "right"
	DirectionIdle  Direction = "idle"
)

// Player is the authoritative sync state for one connected player.
type Player struct {
	ID        string
	Nickname  string
	X         float64
	Y         float64
	Direction Direction
	Alive     bool
}
