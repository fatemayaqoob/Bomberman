package lobby

import (
	"errors"
	"fmt"
	"strings"
)

var ErrEmptyNickname = errors.New("nickname is required")

// Service exposes lobby use cases independent from transport concerns.
type Service struct {
	repo PlayerRepository
	ids  IDGenerator
}

func NewService(repo PlayerRepository, ids IDGenerator) *Service {
	return &Service{repo: repo, ids: ids}
}

// ConnectPlayer validates nickname, creates an ID, and stores a player in memory.
func (s *Service) ConnectPlayer(nickname string) (Player, int, error) {
	cleanNickname := strings.TrimSpace(nickname)
	if cleanNickname == "" {
		return Player{}, 0, ErrEmptyNickname
	}

	id, err := s.ids.NewID()
	if err != nil {
		return Player{}, 0, err
	}

	player := Player{ID: id, Nickname: cleanNickname}
	if err := s.repo.Add(player); err != nil {
		return Player{}, 0, fmt.Errorf("store player: %w", err)
	}

	return player, s.repo.Count(), nil
}

// DisconnectPlayer removes a player and returns the updated count.
func (s *Service) DisconnectPlayer(playerID string) int {
	s.repo.Remove(playerID)
	return s.repo.Count()
}

func (s *Service) PlayerCount() int {
	return s.repo.Count()
}
