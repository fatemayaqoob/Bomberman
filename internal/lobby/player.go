package lobby

// Player is the lobby domain entity for a connected user.
type Player struct {
	ID       string
	Nickname string
	Hat      string
}
