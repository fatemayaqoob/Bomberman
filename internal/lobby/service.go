package lobby

import (
	"crypto/rand"
	"errors"
	"fmt"
	"strings"
)

var ErrEmptyNickname = errors.New("nickname is required")

var validHats = []string{"none", "hat", "crown", "frost", "santa"}

// Service exposes lobby use cases independent from transport concerns.
type Service struct {
	repo PlayerRepository
	ids  IDGenerator
}

func NewService(repo PlayerRepository, ids IDGenerator) *Service {
	return &Service{repo: repo, ids: ids}
}

// ConnectPlayer validates nickname, creates an ID, and stores a player in memory.
func (s *Service) ConnectPlayer(nickname, preferredHat string) (Player, int, error) {
	cleanNickname := strings.TrimSpace(nickname)
	if cleanNickname == "" {
		return Player{}, 0, ErrEmptyNickname
	}

	id, err := s.ids.NewID()
	if err != nil {
		return Player{}, 0, err
	}

	player := Player{ID: id, Nickname: cleanNickname, Hat: chooseHat(preferredHat, s.repo.List())}
	if err := s.repo.Add(player); err != nil {
		return Player{}, 0, fmt.Errorf("store player: %w", err)
	}

	return player, s.repo.Count(), nil
}

func chooseHat(preferred string, players []Player) string {
	available := make([]string, 0, len(validHats))
	taken := make(map[string]bool)
	for _, player := range players {
		if player.Hat != "none" {
			taken[player.Hat] = true
		}
	}

	if isValidHat(preferred) && (preferred == "none" || !taken[preferred]) {
		return preferred
	}
	for _, hat := range validHats {
		if hat == "none" || !taken[hat] {
			available = append(available, hat)
		}
	}
	if len(available) == 0 {
		return "none"
	}
	var randomByte [1]byte
	if _, err := rand.Read(randomByte[:]); err == nil {
		return available[int(randomByte[0])%len(available)]
	}
	return available[0]
}

func isValidHat(hat string) bool {
	for _, candidate := range validHats {
		if hat == candidate {
			return true
		}
	}
	return false
}

// DisconnectPlayer removes a player and returns the updated count.
func (s *Service) DisconnectPlayer(playerID string) int {
	s.repo.Remove(playerID)
	return s.repo.Count()
}

func (s *Service) PlayerCount() int {
	return s.repo.Count()
}

// Players returns all connected players in join order.
func (s *Service) Players() []Player {
	return s.repo.List()
}
