package httpserver

import (
	"fmt"
	"log"
	"net/http"
	"time"

	"github.com/gorilla/websocket"
)

var wsUpgrader = websocket.Upgrader{
	// This keeps the foundation simple. Replace with strict origin checks later.
	CheckOrigin: func(_ *http.Request) bool { return true },
}

const (
	wsWriteTimeout = 5 * time.Second
	wsCloseReason  = "server shutdown"
)

type websocketSession struct {
	conn *websocket.Conn
}

func newWebsocketSession(conn *websocket.Conn) *websocketSession {
	return &websocketSession{conn: conn}
}

func (s *websocketSession) run() {
	defer s.closeGracefully(websocket.CloseNormalClosure, wsCloseReason)

	if err := s.sendWelcome(); err != nil {
		log.Printf("failed to send welcome message: %v", err)
		return
	}

	s.readLoop()
}

func (s *websocketSession) sendWelcome() error {
	return s.conn.WriteMessage(websocket.TextMessage, []byte("welcome"))
}

func (s *websocketSession) readLoop() {
	for {
		msgType, payload, err := s.conn.ReadMessage()
		if err != nil {
			if websocket.IsCloseError(err, websocket.CloseNormalClosure, websocket.CloseGoingAway) {
				log.Printf("websocket closed by client: %v", err)
			} else if websocket.IsUnexpectedCloseError(err) {
				log.Printf("unexpected websocket close: %v", err)
			} else {
				log.Printf("websocket read stopped: %v", err)
			}
			return
		}

		log.Printf("websocket message received type=%s payload=%q", messageTypeName(msgType), string(payload))
	}
}

func (s *websocketSession) closeGracefully(code int, reason string) {
	deadline := time.Now().Add(wsWriteTimeout)
	if err := s.conn.WriteControl(websocket.CloseMessage, websocket.FormatCloseMessage(code, reason), deadline); err != nil {
		log.Printf("failed to send websocket close frame: %v", err)
	}

	if err := s.conn.Close(); err != nil {
		log.Printf("failed to close websocket connection: %v", err)
	}
}

func messageTypeName(msgType int) string {
	switch msgType {
	case websocket.TextMessage:
		return "text"
	case websocket.BinaryMessage:
		return "binary"
	case websocket.CloseMessage:
		return "close"
	case websocket.PingMessage:
		return "ping"
	case websocket.PongMessage:
		return "pong"
	default:
		return fmt.Sprintf("unknown(%d)", msgType)
	}
}

func wsHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		writeHTTPError(w, http.StatusMethodNotAllowed, "method not allowed")
		return
	}

	conn, err := wsUpgrader.Upgrade(w, r, nil)
	if err != nil {
		writeHTTPError(w, http.StatusBadRequest, "websocket upgrade failed")
		return
	}

	newWebsocketSession(conn).run()
}
