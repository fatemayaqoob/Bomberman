package httpserver

import (
	"log"
	"net/http"
	"time"

	"github.com/gorilla/websocket"
)

var wsUpgrader = websocket.Upgrader{
	// This keeps the foundation simple. Replace with strict origin checks later.
	CheckOrigin: func(_ *http.Request) bool { return true },
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
	defer conn.Close()

	// Foundation behavior only: immediately acknowledge then close.
	if err := conn.WriteControl(websocket.CloseMessage, websocket.FormatCloseMessage(websocket.CloseNormalClosure, "foundation only"), time.Now().Add(time.Second)); err != nil {
		log.Printf("failed to write websocket close frame: %v", err)
	}
}
