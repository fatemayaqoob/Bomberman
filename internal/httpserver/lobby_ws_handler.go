package httpserver

import (
	"encoding/json"
	"errors"
	"log"
	"net/http"
	"strings"
	"sync"
	"time"

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
	repo := lobby.NewInMemoryPlayerRepository()
	idGenerator := lobby.NewCryptoIDGenerator()
	service := lobby.NewService(repo, idGenerator)

	return &lobbyWSHandler{
		hub: newLobbyHub(service),
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

	nickname, err := readNickname(client.conn)
	if err != nil {
		log.Printf("lobby nickname read failed: %v", err)
		writeClientError(client.conn, "nickname required")
		return
	}

	player, count, err := h.hub.register(client, nickname)
	if err != nil {
		log.Printf("lobby register failed: %v", err)
		writeClientError(client.conn, "failed to join lobby")
		return
	}

	defer func() {
		newCount := h.hub.unregister(player.ID)
		h.hub.broadcastCount(newCount)
	}()

	h.hub.broadcastCount(count)
	h.readUntilDisconnect(client.conn)
}

func (h *lobbyWSHandler) readUntilDisconnect(conn *websocket.Conn) {
	for {
		if _, _, err := conn.ReadMessage(); err != nil {
			if websocket.IsCloseError(err, websocket.CloseNormalClosure, websocket.CloseGoingAway) {
				log.Printf("lobby websocket closed by client: %v", err)
			} else if websocket.IsUnexpectedCloseError(err) {
				log.Printf("lobby websocket unexpected close: %v", err)
			} else {
				log.Printf("lobby websocket read stopped: %v", err)
			}
			return
		}
	}
}

type nicknameEnvelope struct {
	Nickname string `json:"nickname"`
}

func readNickname(conn *websocket.Conn) (string, error) {
	if err := conn.SetReadDeadline(time.Now().Add(nicknameReadTimeout)); err != nil {
		return "", err
	}

	msgType, payload, err := conn.ReadMessage()
	if err != nil {
		return "", err
	}

	if err := conn.SetReadDeadline(time.Time{}); err != nil {
		return "", err
	}

	if msgType != websocket.TextMessage {
		return "", errors.New("nickname must be a text message")
	}

	raw := strings.TrimSpace(string(payload))
	if raw == "" {
		return "", lobby.ErrEmptyNickname
	}

	var envelope nicknameEnvelope
	if err := json.Unmarshal(payload, &envelope); err == nil {
		if strings.TrimSpace(envelope.Nickname) == "" {
			return "", lobby.ErrEmptyNickname
		}

		return envelope.Nickname, nil
	}

	return raw, nil
}

type lobbyClient struct {
	conn    *websocket.Conn
	writeMu sync.Mutex
}

type lobbyHub struct {
	service *lobby.Service

	mu      sync.RWMutex
	clients map[string]*lobbyClient
}

func newLobbyHub(service *lobby.Service) *lobbyHub {
	return &lobbyHub{
		service: service,
		clients: make(map[string]*lobbyClient),
	}
}

func (h *lobbyHub) register(client *lobbyClient, nickname string) (lobby.Player, int, error) {
	player, count, err := h.service.ConnectPlayer(nickname)
	if err != nil {
		return lobby.Player{}, 0, err
	}

	h.mu.Lock()
	h.clients[player.ID] = client
	h.mu.Unlock()

	return player, count, nil
}

func (h *lobbyHub) unregister(playerID string) int {
	h.mu.Lock()
	delete(h.clients, playerID)
	h.mu.Unlock()

	return h.service.DisconnectPlayer(playerID)
}

func (h *lobbyHub) broadcastCount(count int) {
	message, err := json.Marshal(map[string]any{
		"type":         "lobby_player_count",
		"player_count": count,
	})
	if err != nil {
		log.Printf("lobby broadcast marshal failed: %v", err)
		return
	}

	h.mu.RLock()
	clients := make([]*lobbyClient, 0, len(h.clients))
	for _, client := range h.clients {
		clients = append(clients, client)
	}
	h.mu.RUnlock()

	for _, client := range clients {
		if err := writeClientMessage(client, websocket.TextMessage, message); err != nil {
			log.Printf("lobby broadcast failed: %v", err)
		}
	}
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
