// Package chat contains chat business logic, kept independent of the
// WebSocket transport and the Lobby domain so it can be reused/extended
// (e.g. moderation, rate limiting) without touching either.
package chat

import (
	"errors"
	"strings"
)

// ErrEmptyMessage is returned when a chat message has no visible content.
var ErrEmptyMessage = errors.New("message is required")

// Message is a validated chat message ready to broadcast.
type Message struct {
	Nickname string
	Text     string
}

// NewMessage trims nickname/text and rejects empty messages.
func NewMessage(nickname, text string) (Message, error) {
	nickname = strings.TrimSpace(nickname)
	text = strings.TrimSpace(text)

	if text == "" {
		return Message{}, ErrEmptyMessage
	}

	return Message{Nickname: nickname, Text: text}, nil
}
