package httpserver

import (
	"encoding/json"
	"log"

	"bomberman-dom/internal/game"

	"github.com/gorilla/websocket"
)

// Player synchronization protocol.
//
// This is deliberately separate from the Lobby ("lobby_state") and Chat
// ("chat_message") protocols above: it only carries connected players'
// positions and basic state, no game rules (bombs/powerups/combat).
//
// Client -> Server, sent whenever the local player moves:
//
//	{"type": "player_move", "x": 3, "y": 5, "direction": "left"}
//
// direction is one of "up", "down", "left", "right", "idle".
//
// Server -> Clients, broadcast to every connected client whenever a
// player joins, leaves, or moves:
//
//	{
//	  "type": "player_state",
//	  "players": [
//	    {"id": "abc123", "nickname": "Ahmed", "x": 3, "y": 5, "direction": "left", "alive": true}
//	  ]
//	}
type playerMoveEnvelope struct {
	Type      string  `json:"type"`
	X         float64 `json:"x"`
	Y         float64 `json:"y"`
	Direction string  `json:"direction"`
}

type playerStateDTO struct {
	ID        string  `json:"id"`
	Nickname  string  `json:"nickname"`
	X         float64 `json:"x"`
	Y         float64 `json:"y"`
	Direction string  `json:"direction"`
	Alive     bool    `json:"alive"`
}

type playerStateMessage struct {
	Type    string           `json:"type"`
	Players []playerStateDTO `json:"players"`
}

// validDirections guards the authoritative state against arbitrary
// strings sent by a client.
var validDirections = map[string]game.Direction{
	"up":    game.DirectionUp,
	"down":  game.DirectionDown,
	"left":  game.DirectionLeft,
	"right": game.DirectionRight,
	"idle":  game.DirectionIdle,
}

func marshalGameSnapshot(players []game.Player) ([]byte, error) {
	msg := playerStateMessage{
		Type:    "player_state",
		Players: make([]playerStateDTO, 0, len(players)),
	}

	for _, p := range players {
		msg.Players = append(msg.Players, playerStateDTO{
			ID:        p.ID,
			Nickname:  p.Nickname,
			X:         p.X,
			Y:         p.Y,
			Direction: string(p.Direction),
			Alive:     p.Alive,
		})
	}

	return json.Marshal(msg)
}

// handlePlayerMove applies a client's reported position to the
// authoritative game state and, if accepted, broadcasts the new state to
// every connected client.
func (h *lobbyHub) handlePlayerMove(client *lobbyClient, payload []byte) {
	var move playerMoveEnvelope
	if err := json.Unmarshal(payload, &move); err != nil {
		log.Printf("sync ws: invalid player_move payload: %v", err)
		return
	}

	direction, ok := validDirections[move.Direction]
	if !ok {
		direction = game.DirectionIdle
	}

	if !h.game.UpdatePosition(client.playerID, move.X, move.Y, direction) {
		return
	}

	h.broadcastGameState()
}

func (h *lobbyHub) broadcastGameState() {
	payload, err := marshalGameSnapshot(h.game.Snapshot())
	if err != nil {
		log.Printf("sync broadcast marshal failed: %v", err)
		return
	}

	h.mu.RLock()
	clients := make([]*lobbyClient, 0, len(h.clients))
	for _, c := range h.clients {
		clients = append(clients, c)
	}
	h.mu.RUnlock()

	for _, c := range clients {
		if err := writeClientMessage(c, websocket.TextMessage, payload); err != nil {
			log.Printf("sync broadcast failed: %v", err)
		}
	}
}
