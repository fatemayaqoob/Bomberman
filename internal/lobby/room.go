package lobby

import (
	"errors"
	"sync"
	"time"
)

// State is the lifecycle stage of a lobby Room.
type State string

const (
	StateWaiting   State = "waiting"
	StateCountdown State = "countdown"
	StateStarted   State = "started"
)

const (
	// WaitForPlayersDuration is how long the room waits for more players to
	// join, once MinPlayers is reached, before starting the countdown.
	WaitForPlayersDuration = 20 * time.Second
	// CountdownDuration is the "get ready" window before the match starts.
	CountdownDuration = 10 * time.Second
)

// ErrLobbyStarted is returned when a join is attempted after the game has
// already transitioned out of the lobby.
var ErrLobbyStarted = errors.New("lobby already started")

// Snapshot is an immutable view of a Room, safe to broadcast or hand to
// other modules (Chat, Sync) without exposing the Room's internal locking.
type Snapshot struct {
	State           State
	Players         []Player
	PlayerCount     int
	MinPlayers      int
	MaxPlayers      int
	CountdownEndsAt time.Time
}

// Room orchestrates the waiting -> countdown -> started state machine on
// top of Service. It is safe for concurrent use. All state changes funnel
// through a single mutex so timers can never race each other or duplicate
// a countdown/game start.
type Room struct {
	mu       sync.Mutex
	service  *Service
	state    State
	onUpdate func(Snapshot)

	// generation invalidates in-flight timers once timers are cancelled or
	// replaced, so a stale timer firing after a state change is a no-op.
	generation int

	waitTimer       *time.Timer
	countdownTimer  *time.Timer
	countdownEndsAt time.Time
}

// NewRoom creates a Room bound to service. onUpdate is called (outside the
// Room's lock) with the latest Snapshot whenever a player joins/leaves or
// the state transitions (waiting -> countdown -> started).
func NewRoom(service *Service, onUpdate func(Snapshot)) *Room {
	if onUpdate == nil {
		onUpdate = func(Snapshot) {}
	}

	return &Room{
		service:  service,
		state:    StateWaiting,
		onUpdate: onUpdate,
	}
}

// Join adds a player to the room, updates timers accordingly, and returns
// the resulting snapshot. It fails if the room already started or is full.
func (r *Room) Join(nickname string) (Player, Snapshot, error) {
	r.mu.Lock()

	if r.state == StateStarted {
		r.mu.Unlock()
		return Player{}, Snapshot{}, ErrLobbyStarted
	}

	player, _, err := r.service.ConnectPlayer(nickname)
	if err != nil {
		r.mu.Unlock()
		return Player{}, Snapshot{}, err
	}

	r.evaluateLocked()
	snapshot := r.snapshotLocked()
	r.mu.Unlock()

	r.onUpdate(snapshot)
	return player, snapshot, nil
}

// Leave removes a player and updates timers accordingly, returning the
// resulting snapshot.
func (r *Room) Leave(playerID string) Snapshot {
	r.mu.Lock()

	r.service.DisconnectPlayer(playerID)

	if r.state != StateStarted {
		r.evaluateLocked()
	}

	snapshot := r.snapshotLocked()
	r.mu.Unlock()

	r.onUpdate(snapshot)
	return snapshot
}

// Snapshot returns the current room state without mutating anything.
func (r *Room) Snapshot() Snapshot {
	r.mu.Lock()
	defer r.mu.Unlock()

	return r.snapshotLocked()
}

func (r *Room) snapshotLocked() Snapshot {
	return Snapshot{
		State:           r.state,
		Players:         r.service.Players(),
		PlayerCount:     r.service.PlayerCount(),
		MinPlayers:      MinPlayers,
		MaxPlayers:      MaxPlayers,
		CountdownEndsAt: r.countdownEndsAt,
	}
}

// evaluateLocked recomputes waiting/countdown timers after a join or leave.
// Must be called with r.mu held.
func (r *Room) evaluateLocked() {
	count := r.service.PlayerCount()

	switch {
	case count < MinPlayers:
		// Below the minimum: always (back) to waiting, no timers running.
		if r.state != StateWaiting || r.waitTimer != nil || r.countdownTimer != nil {
			r.cancelTimersLocked()
			r.state = StateWaiting
		}
	case count >= MaxPlayers:
		// Full room: skip straight to the countdown, even if still waiting.
		if r.state == StateWaiting {
			r.cancelTimersLocked()
			r.startCountdownLocked()
		}
	default:
		// MinPlayers <= count < MaxPlayers: start the 20s wait timer once.
		if r.state == StateWaiting && r.waitTimer == nil {
			r.startWaitTimerLocked()
		}
	}
}

func (r *Room) cancelTimersLocked() {
	r.generation++

	if r.waitTimer != nil {
		r.waitTimer.Stop()
		r.waitTimer = nil
	}
	if r.countdownTimer != nil {
		r.countdownTimer.Stop()
		r.countdownTimer = nil
	}
	r.countdownEndsAt = time.Time{}
}

func (r *Room) startWaitTimerLocked() {
	r.generation++
	gen := r.generation

	r.waitTimer = time.AfterFunc(WaitForPlayersDuration, func() {
		r.onWaitTimeout(gen)
	})
}

func (r *Room) startCountdownLocked() {
	r.generation++
	gen := r.generation

	r.state = StateCountdown
	r.countdownEndsAt = time.Now().Add(CountdownDuration)
	r.countdownTimer = time.AfterFunc(CountdownDuration, func() {
		r.onCountdownTimeout(gen)
	})
}

func (r *Room) onWaitTimeout(gen int) {
	r.mu.Lock()
	if gen != r.generation || r.state != StateWaiting {
		r.mu.Unlock()
		return
	}

	r.waitTimer = nil
	r.startCountdownLocked()
	snapshot := r.snapshotLocked()
	r.mu.Unlock()

	r.onUpdate(snapshot)
}

func (r *Room) onCountdownTimeout(gen int) {
	r.mu.Lock()
	if gen != r.generation || r.state != StateCountdown {
		r.mu.Unlock()
		return
	}

	r.countdownTimer = nil
	r.state = StateStarted
	snapshot := r.snapshotLocked()
	r.mu.Unlock()

	r.onUpdate(snapshot)
}
