package httpserver

import (
	"encoding/json"
	"errors"
	"log"
	"math"
	"net/http"
	"strings"
	"sync"
	"time"

	"bomberman-dom/internal/chat"
	"bomberman-dom/internal/game"
	"bomberman-dom/internal/lobby"

	"github.com/gorilla/websocket"
)

const (
	lobbyWriteTimeout   = 5 * time.Second
	nicknameReadTimeout = 30 * time.Second
)

type lobbyWSHandler struct {
	hub *lobbyHub
}

func newLobbyWSHandler() *lobbyWSHandler {
	return &lobbyWSHandler{
		hub: newLobbyHub(),
	}
}

func (h *lobbyWSHandler) Handle(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		writeHTTPError(w, http.StatusMethodNotAllowed, "method not allowed")
		return
	}

	conn, err := wsUpgrader.Upgrade(w, r, nil)
	if err != nil {
		writeHTTPError(w, http.StatusBadRequest, "websocket upgrade failed")
		return
	}

	h.handleConnection(conn)
}

func (h *lobbyWSHandler) handleConnection(conn *websocket.Conn) {
	client := &lobbyClient{conn: conn}
	defer closeConn(client.conn)

	nickname, hat, err := readNickname(client.conn)
	if err != nil {
		log.Printf("lobby nickname read failed: %v", err)
		writeClientError(client.conn, "nickname required")
		return
	}

	_, err = h.hub.register(client, nickname, hat)
	if err != nil {
		log.Printf("lobby register failed: %v", err)
		writeClientError(client.conn, lobbyJoinErrorMessage(err))
		return
	}

	defer h.hub.unregister(client)

	h.readUntilDisconnect(client)
}

// lobbyJoinErrorMessage maps internal lobby errors to client-safe messages.
func lobbyJoinErrorMessage(err error) string {
	switch {
	case errors.Is(err, lobby.ErrLobbyFull):
		return "lobby is full"
	case errors.Is(err, lobby.ErrLobbyStarted):
		return "game already in progress"
	case errors.Is(err, lobby.ErrEmptyNickname):
		return "nickname is required"
	case errors.Is(err, lobby.ErrNicknameTaken):
		return "nickname already taken"
	default:
		return "failed to join lobby"
	}
}

func (h *lobbyWSHandler) readUntilDisconnect(client *lobbyClient) {
	for {
		msgType, payload, err := client.conn.ReadMessage()
		if err != nil {
			if websocket.IsCloseError(err, websocket.CloseNormalClosure, websocket.CloseGoingAway) {
				log.Printf("lobby websocket closed by client: %v", err)
			} else if websocket.IsUnexpectedCloseError(err) {
				log.Printf("lobby websocket unexpected close: %v", err)
			} else {
				log.Printf("lobby websocket read stopped: %v", err)
			}
			return
		}

		if msgType != websocket.TextMessage {
			continue
		}

		h.hub.handleIncoming(client, payload)
	}
}

// incomingEnvelope is the generic shape used to dispatch client -> server
// messages by "type" once past the initial nickname handshake.
type incomingEnvelope struct {
	Type    string          `json:"type"`
	Message string          `json:"message"`
	State   json.RawMessage `json:"state"`
}

// chatOutgoingMessage is the server -> clients broadcast shape for chat.
//
// Protocol:
//
//	Client -> Server: {"type": "chat_message", "message": "Hello"}
//	Server -> Clients: {"type": "chat_message", "nickname": "Ahmed", "message": "Hello"}
type chatOutgoingMessage struct {
	Type     string `json:"type"`
	Nickname string `json:"nickname"`
	Message  string `json:"message"`
}

func (h *lobbyHub) handleIncoming(client *lobbyClient, payload []byte) {
	var envelope incomingEnvelope
	if err := json.Unmarshal(payload, &envelope); err != nil {
		log.Printf("lobby ws: invalid message payload: %v", err)
		return
	}

	switch envelope.Type {
	case "chat_message":
		h.handleChatMessage(client, envelope.Message)
	case "player_move":
		h.handlePlayerMove(client, payload)
	case "play_again":
		h.playAgain(client)
	case "game_state":
		h.relayGameState(client, envelope.State)
	default:
		log.Printf("lobby ws: unknown message type %q", envelope.Type)
	}
}

func (h *lobbyHub) handleChatMessage(client *lobbyClient, text string) {
	msg, err := chat.NewMessage(client.nickname, text)
	if err != nil {
		writeClientError(client.conn, "message cannot be empty")
		return
	}

	h.broadcastChat(msg)
}

// playAgain moves only the requesting completed-match player to the next
// waiting room. The connection stays open, but the old match membership and
// position are removed before the player can be queued again.
func (h *lobbyHub) playAgain(client *lobbyClient) {
	h.mu.Lock()
	if client.phase != clientActive || h.activeMatch == nil || h.activeMatch.players[client.playerID] != client {
		h.mu.Unlock()
		return
	}
	oldID := client.playerID
	removeFromMatchLocked(h.activeMatch, oldID)
	h.game.Leave(oldID)
	delete(h.clients, oldID)
	if len(h.activeMatch.players) == 0 {
		h.activeMatch = nil
	}
	h.mu.Unlock()

	player, snapshot, err := h.waitingRoom.Join(client.nickname, h.availableHat(client.hat, client))
	if err != nil {
		writeClientError(client.conn, "could not join the next-match lobby")
		return
	}

	h.mu.Lock()
	client.playerID = player.ID
	client.hat = player.Hat
	client.phase = clientWaiting
	h.clients[player.ID] = client
	h.mu.Unlock()
	h.ensurePromoted(client, snapshot)

	h.sendSnapshotTo(client, snapshot)
	h.broadcastGameState()
	h.broadcastMatchState()
}

// The existing browser engine remains the rules implementation. The server
// retains and broadcasts the active match's latest valid gameplay snapshot so
// bombs, blocks, power-ups and player damage are shared by every participant.
func (h *lobbyHub) relayGameState(client *lobbyClient, state json.RawMessage) {
	if len(state) == 0 || len(state) > 512*1024 || !json.Valid(state) {
		return
	}
	h.mu.Lock()
	if client.phase != clientActive || h.activeMatch == nil || h.activeMatch.players[client.playerID] != client {
		h.mu.Unlock()
		return
	}
	h.activeMatch.gameState = append(h.activeMatch.gameState[:0], state...)
	clients := make([]*lobbyClient, 0, len(h.activeMatch.players))
	for _, member := range h.activeMatch.players {
		clients = append(clients, member)
	}
	h.mu.Unlock()

	payload, err := json.Marshal(struct {
		Type  string          `json:"type"`
		State json.RawMessage `json:"state"`
	}{Type: "game_state", State: state})
	if err != nil {
		return
	}
	for _, member := range clients {
		if err := writeClientMessage(member, websocket.TextMessage, payload); err != nil {
			log.Printf("game state broadcast failed: %v", err)
		}
	}
}

func (h *lobbyHub) broadcastChat(msg chat.Message) {
	payload, err := json.Marshal(chatOutgoingMessage{
		Type:     "chat_message",
		Nickname: msg.Nickname,
		Message:  msg.Text,
	})
	if err != nil {
		log.Printf("chat broadcast marshal failed: %v", err)
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
			log.Printf("chat broadcast failed: %v", err)
		}
	}
}

type nicknameEnvelope struct {
	Nickname string `json:"nickname"`
	Hat      string `json:"hat"`
}

func readNickname(conn *websocket.Conn) (string, string, error) {
	if err := conn.SetReadDeadline(time.Now().Add(nicknameReadTimeout)); err != nil {
		return "", "", err
	}

	msgType, payload, err := conn.ReadMessage()
	if err != nil {
		return "", "", err
	}

	if err := conn.SetReadDeadline(time.Time{}); err != nil {
		return "", "", err
	}

	if msgType != websocket.TextMessage {
		return "", "", errors.New("nickname must be a text message")
	}

	raw := strings.TrimSpace(string(payload))
	if raw == "" {
		return "", "", lobby.ErrEmptyNickname
	}

	var envelope nicknameEnvelope
	if err := json.Unmarshal(payload, &envelope); err == nil {
		if strings.TrimSpace(envelope.Nickname) == "" {
			return "", "", lobby.ErrEmptyNickname
		}

		return envelope.Nickname, envelope.Hat, nil
	}

	return raw, "none", nil
}

type lobbyClient struct {
	conn     *websocket.Conn
	writeMu  sync.Mutex
	nickname string
	playerID string
	hat      string
	phase    clientPhase
}

type clientPhase string

const (
	clientWaiting clientPhase = "waiting"
	clientActive  clientPhase = "active"
)

type activeMatch struct {
	id      uint64
	seed    uint32
	players map[string]*lobbyClient
	// order preserves join order so every client receives the same player
	// list order, instead of Go's randomized map iteration order.
	order     []string
	gameState json.RawMessage
}

type lobbyHub struct {
	waitingRoom *lobby.Room
	activeMatch *activeMatch
	game        *game.State
	nextMatchID uint64

	mu      sync.RWMutex
	clients map[string]*lobbyClient
}

func newLobbyHub() *lobbyHub {
	h := &lobbyHub{
		clients: make(map[string]*lobbyClient),
		game:    game.NewState(),
	}
	h.waitingRoom = h.newWaitingRoom()

	return h
}

func (h *lobbyHub) newWaitingRoom() *lobby.Room {
	service := lobby.NewService(lobby.NewInMemoryPlayerRepository(), lobby.NewCryptoIDGenerator())
	return lobby.NewRoom(service, h.handleWaitingSnapshot)
}

func (h *lobbyHub) register(client *lobbyClient, nickname, hat string) (lobby.Player, error) {
	h.mu.RLock()
	if h.activeMatch != nil {
		h.mu.RUnlock()
		return lobby.Player{}, lobby.ErrLobbyStarted
	}
	waitingRoom := h.waitingRoom
	h.mu.RUnlock()

	player, snapshot, err := waitingRoom.Join(nickname, h.availableHat(hat, nil))
	if err != nil {
		return lobby.Player{}, err
	}

	client.nickname = player.Nickname
	client.playerID = player.ID
	client.hat = player.Hat
	client.phase = clientWaiting

	h.mu.Lock()
	h.clients[player.ID] = client
	h.mu.Unlock()
	h.ensurePromoted(client, snapshot)

	// The join already broadcast this snapshot to previously-connected
	// clients; send it directly to the new client too, since it wasn't
	// registered yet when the broadcast fired.
	h.sendSnapshotTo(client, snapshot)

	return player, nil
}

// Room callbacks run before Join returns. If a player is the final promotion
// slot, attach that now-identified connection to the just-created match.
func (h *lobbyHub) ensurePromoted(client *lobbyClient, snapshot lobby.Snapshot) {
	if snapshot.State != lobby.StateStarted {
		return
	}
	h.mu.Lock()
	if h.activeMatch != nil && h.activeMatch.seed == snapshot.MatchSeed && client.phase == clientWaiting {
		client.phase = clientActive
		h.activeMatch.players[client.playerID] = client
		h.game.Join(client.playerID, client.nickname)
	}
	h.mu.Unlock()
	h.sendMatchStateTo(client)
}

// removeFromMatchLocked detaches a player from the live match roster and its
// join-order list, so later match broadcasts never reference a stale member.
// Callers must hold h.mu.
func removeFromMatchLocked(match *activeMatch, playerID string) {
	delete(match.players, playerID)
	for i, id := range match.order {
		if id == playerID {
			match.order = append(match.order[:i], match.order[i+1:]...)
			break
		}
	}
}

func (h *lobbyHub) unregister(client *lobbyClient) {
	h.mu.Lock()
	phase := client.phase
	playerID := client.playerID
	if phase == clientActive && h.activeMatch != nil {
		removeFromMatchLocked(h.activeMatch, playerID)
		h.game.Leave(playerID)
		if len(h.activeMatch.players) == 0 {
			h.activeMatch = nil
		}
	}
	delete(h.clients, playerID)
	h.mu.Unlock()

	if phase == clientWaiting {
		h.waitingRoom.Leave(playerID)
	} else {
		h.broadcastGameState()
		h.broadcastMatchState()
	}
}

type lobbyPlayerDTO struct {
	ID       string `json:"id"`
	Nickname string `json:"nickname"`
	Hat      string `json:"hat"`
}

type lobbyStateMessage struct {
	Type             string           `json:"type"`
	State            string           `json:"state"`
	PlayerCount      int              `json:"player_count"`
	MinPlayers       int              `json:"min_players"`
	MaxPlayers       int              `json:"max_players"`
	Players          []lobbyPlayerDTO `json:"players"`
	WaitEndsAt       *time.Time       `json:"wait_ends_at,omitempty"`
	CountdownSeconds *int             `json:"countdown_seconds,omitempty"`
	CountdownEndsAt  *time.Time       `json:"countdown_ends_at,omitempty"`
	SelfID           string           `json:"self_id,omitempty"`
	MatchSeed        uint32           `json:"match_seed,omitempty"`
}

func marshalSnapshot(snapshot lobby.Snapshot) ([]byte, error) {
	return marshalSnapshotFor(snapshot, "")
}

func marshalSnapshotFor(snapshot lobby.Snapshot, selfID string) ([]byte, error) {
	msg := lobbyStateMessage{
		Type:        "lobby_state",
		State:       string(snapshot.State),
		PlayerCount: snapshot.PlayerCount,
		MinPlayers:  snapshot.MinPlayers,
		MaxPlayers:  snapshot.MaxPlayers,
		Players:     make([]lobbyPlayerDTO, 0, len(snapshot.Players)),
		SelfID:      selfID,
		MatchSeed:   snapshot.MatchSeed,
	}

	for _, p := range snapshot.Players {
		msg.Players = append(msg.Players, lobbyPlayerDTO{ID: p.ID, Nickname: p.Nickname, Hat: p.Hat})
	}

	if snapshot.State == lobby.StateCountdown {
		remaining := int(math.Ceil(time.Until(snapshot.CountdownEndsAt).Seconds()))
		if remaining < 0 {
			remaining = 0
		}
		msg.CountdownSeconds = &remaining
		msg.CountdownEndsAt = &snapshot.CountdownEndsAt
	} else if snapshot.State == lobby.StateWaiting && !snapshot.WaitEndsAt.IsZero() {
		msg.WaitEndsAt = &snapshot.WaitEndsAt
	}

	return json.Marshal(msg)
}

// handleWaitingSnapshot only addresses players queued for the next match.
// When its countdown finishes, that exact roster is promoted to an isolated
// active match and a fresh empty waiting room immediately replaces it.
func (h *lobbyHub) handleWaitingSnapshot(snapshot lobby.Snapshot) {
	if snapshot.State == lobby.StateStarted {
		h.promoteWaitingPlayers(snapshot)
		return
	}

	h.mu.RLock()
	clients := make([]*lobbyClient, 0, len(h.clients))
	for _, client := range h.clients {
		if client.phase == clientWaiting {
			clients = append(clients, client)
		}
	}
	h.mu.RUnlock()

	for _, client := range clients {
		h.sendSnapshotTo(client, snapshot)
	}
}

func (h *lobbyHub) promoteWaitingPlayers(snapshot lobby.Snapshot) {
	h.mu.Lock()
	if h.activeMatch != nil {
		h.mu.Unlock()
		return
	}

	h.nextMatchID++
	match := &activeMatch{
		id:      h.nextMatchID,
		seed:    snapshot.MatchSeed,
		players: make(map[string]*lobbyClient, len(snapshot.Players)),
	}
	for _, player := range snapshot.Players {
		client := h.clients[player.ID]
		if client == nil || client.phase != clientWaiting {
			continue
		}
		client.phase = clientActive
		match.players[player.ID] = client
		match.order = append(match.order, player.ID)
		h.game.Join(player.ID, player.Nickname)
	}
	h.activeMatch = match
	// New arrivals now enter a new queue and can never join this match.
	h.waitingRoom = h.newWaitingRoom()
	clients := make([]*lobbyClient, 0, len(match.players))
	for _, client := range match.players {
		clients = append(clients, client)
	}
	h.mu.Unlock()

	for _, client := range clients {
		h.sendMatchStateTo(client)
	}
	h.broadcastGameState()
}

func (h *lobbyHub) sendSnapshotTo(client *lobbyClient, snapshot lobby.Snapshot) {
	payload, err := marshalSnapshotFor(snapshot, client.playerID)
	if err != nil {
		log.Printf("lobby snapshot marshal failed: %v", err)
		return
	}

	if err := writeClientMessage(client, websocket.TextMessage, payload); err != nil {
		log.Printf("lobby snapshot send failed: %v", err)
	}
}

func (h *lobbyHub) sendMatchStateTo(client *lobbyClient) {
	h.mu.RLock()
	match := h.activeMatch
	if match == nil || match.players[client.playerID] == nil {
		h.mu.RUnlock()
		return
	}
	players := make([]lobbyPlayerDTO, 0, len(match.order))
	for _, id := range match.order {
		member := match.players[id]
		if member == nil {
			continue
		}
		players = append(players, lobbyPlayerDTO{ID: member.playerID, Nickname: member.nickname, Hat: member.hat})
	}
	message := struct {
		Type      string           `json:"type"`
		State     string           `json:"state"`
		MatchID   uint64           `json:"match_id"`
		MatchSeed uint32           `json:"match_seed"`
		Players   []lobbyPlayerDTO `json:"players"`
		SelfID    string           `json:"self_id"`
	}{"match_state", "started", match.id, match.seed, players, client.playerID}
	h.mu.RUnlock()

	payload, err := json.Marshal(message)
	if err == nil {
		if err := writeClientMessage(client, websocket.TextMessage, payload); err != nil {
			log.Printf("match state send failed: %v", err)
		}
	}
}

func (h *lobbyHub) broadcastMatchState() {
	h.mu.RLock()
	clients := make([]*lobbyClient, 0)
	if h.activeMatch != nil {
		for _, client := range h.activeMatch.players {
			clients = append(clients, client)
		}
	}
	h.mu.RUnlock()
	for _, client := range clients {
		h.sendMatchStateTo(client)
	}
}

func (h *lobbyHub) availableHat(requested string, exclude *lobbyClient) string {
	valid := []string{"none", "hat", "crown", "frost", "santa"}
	taken := make(map[string]bool)
	h.mu.RLock()
	for _, client := range h.clients {
		if client != exclude && client.hat != "none" {
			taken[client.hat] = true
		}
	}
	h.mu.RUnlock()
	if requested == "none" || (!taken[requested] && isKnownHat(requested)) {
		return requested
	}
	for _, hat := range valid {
		if hat == "none" || !taken[hat] {
			return hat
		}
	}
	return "none"
}

func isKnownHat(hat string) bool {
	return hat == "none" || hat == "hat" || hat == "crown" || hat == "frost" || hat == "santa"
}

func writeClientError(conn *websocket.Conn, message string) {
	payload, err := json.Marshal(map[string]any{
		"type":    "error",
		"message": message,
	})
	if err != nil {
		return
	}

	_ = conn.WriteMessage(websocket.TextMessage, payload)
}

func writeClientMessage(client *lobbyClient, messageType int, payload []byte) error {
	client.writeMu.Lock()
	defer client.writeMu.Unlock()

	if err := client.conn.SetWriteDeadline(time.Now().Add(lobbyWriteTimeout)); err != nil {
		return err
	}
	defer client.conn.SetWriteDeadline(time.Time{})

	return client.conn.WriteMessage(messageType, payload)
}

func closeConn(conn *websocket.Conn) {
	deadline := time.Now().Add(lobbyWriteTimeout)
	if err := conn.WriteControl(websocket.CloseMessage, websocket.FormatCloseMessage(websocket.CloseNormalClosure, wsCloseReason), deadline); err != nil {
		log.Printf("failed to send websocket close frame: %v", err)
	}

	if err := conn.Close(); err != nil {
		log.Printf("failed to close websocket connection: %v", err)
	}
}
