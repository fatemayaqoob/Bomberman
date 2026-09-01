import { startGameRuntime } from "./game/runtime.js";

const SESSION_KEY = "bomberman-session";

let uiStore = null;
let lobbyTimer = null;
let stopGameRuntime = null;

export const MAX_PLAYERS = 4;

export function createInitialUIState() {
    const savedSession = readSession();
    const localPlayer = savedSession?.localPlayer ?? {
        id: "player-1",
        nickname: "",
        lives: 3,
        bombs: 1,
        flame: 1,
        speed: 1
    };

    return {
        screen: "nickname",
        localPlayer,
        lobby: {
            players: savedSession?.players ?? [],
            phase: "waiting",
            secondsRemaining: 20
        },
        game: {
            grid: [],
            players: [],
            powerUps: [],
            gameOver: null,
            hud: {
                lives: 3,
                bombs: 1,
                flame: 1,
                speed: 1
            }
        }
    };
}

export function bindUIStore(store) {
    uiStore = store;
}

export function getUIState() {
    return uiStore?.getState();
}

// Change the visible screen and keep the hash route synchronized.
export function setScreen(screen) {
    uiStore?.setState({ screen });
    window.location.hash = `/${screen}`;
}

export function submitNickname(nickname) {
    const cleanName = nickname.trim();

    if (!cleanName) {
        return false;
    }

    const state = getUIState();
    const localPlayer = {
        ...state.localPlayer,
        nickname: cleanName
    };

    uiStore?.setState({ localPlayer });
    setLobbyPlayers([
        {
            id: localPlayer.id,
            nickname: cleanName,
            slot: 0
        }
    ]);
    setScreen("lobby");
    persistSession();

    return true;
}

// Backend hook: replace the lobby list with the authoritative player list.
export function setLobbyPlayers(players) {
    const safePlayers = players.slice(0, MAX_PLAYERS);
    const state = getUIState();

    uiStore?.setState({
        lobby: {
            ...state.lobby,
            players: safePlayers
        }
    });
    persistSession();

    if (safePlayers.length >= 2) {
        startLobbyWait();
    } else {
        resetLobbyTimer();
    }
}

// Backend hook: a smaller helper when only the count is known.
export function setLobbyCount(count) {
    const current = getUIState().lobby.players;
    const playerCount = Math.min(count, MAX_PLAYERS);
    const players = Array.from({ length: playerCount }, (_, index) => {
        return current[index] ?? {
            id: `slot-${index + 1}`,
            nickname: `Player ${index + 1}`,
            slot: index
        };
    });

    setLobbyPlayers(players);
}

export function startLobbyWait() {
    const lobby = getUIState().lobby;

    if (lobby.phase !== "waiting" || lobby.secondsRemaining !== 20) {
        return;
    }

    runCountdown("waiting", 20, beginReadyCountdown);
}

export function beginReadyCountdown() {
    if (getUIState().lobby.players.length >= 2) {
        runCountdown("ready", 10, enterGame);
    }
}

export function resetLobbyTimer() {
    clearInterval(lobbyTimer);
    lobbyTimer = null;

    const state = getUIState();
    uiStore?.setState({
        lobby: {
            ...state.lobby,
            phase: "waiting",
            secondsRemaining: 20
        }
    });
}

export function enterGame() {
    clearInterval(lobbyTimer);
    lobbyTimer = null;

    stopRunningGame();
    const state = getUIState();
    const players = state.lobby.players.length
        ? state.lobby.players
        : [{ id: state.localPlayer.id, nickname: state.localPlayer.nickname || "Player 1", slot: 0 }];
    stopGameRuntime = startGameRuntime({
        players,
        localPlayerID: state.localPlayer.id,
        localPlayerNickname: state.localPlayer.nickname,
        onRestart: enterGame,
        onStateChange: (engineState, visualItems) => {
            const current = getUIState();
            const local = engineState.players.find((player) => player.id === current.localPlayer.id)
                ?? engineState.players.find((player) => player.nickname === current.localPlayer.nickname)
                ?? engineState.players[0];
            uiStore?.setState({
                game: {
                    ...current.game,
                    grid: engineState.grid,
                    players: engineState.players.filter((player) => player.alive),
                    powerUps: visualItems,
                    gameOver: engineState.gameOver,
                    hud: local ? {
                        ...current.game.hud,
                        lives: local.lives,
                        bombs: local.bombs,
                        flame: local.flame,
                        speed: local.speed
                    } : current.game.hud
                }
            });
        }
    });

    setScreen("game");
}

function stopRunningGame() {
    stopGameRuntime?.();
    stopGameRuntime = null;
}

function persistSession() {
    try {
        const state = getUIState();
        window.sessionStorage.setItem(SESSION_KEY, JSON.stringify({
            localPlayer: state.localPlayer,
            players: state.lobby.players
        }));
    } catch {
        // Storage is optional; gameplay still works when it is unavailable.
    }
}

function readSession() {
    try {
        const raw = window.sessionStorage.getItem(SESSION_KEY);
        return raw ? JSON.parse(raw) : null;
    } catch {
        return null;
    }
}

function runCountdown(phase, seconds, complete) {
    clearInterval(lobbyTimer);
    uiStore?.setState({
        lobby: {
            ...getUIState().lobby,
            phase,
            secondsRemaining: seconds
        }
    });

    lobbyTimer = window.setInterval(() => {
        const state = getUIState();
        const secondsRemaining = Math.max(0, state.lobby.secondsRemaining - 1);

        uiStore?.setState({
            lobby: {
                ...state.lobby,
                phase,
                secondsRemaining
            }
        });

        if (secondsRemaining === 0) {
            clearInterval(lobbyTimer);
            lobbyTimer = null;
            complete();
        }
    }, 1000);
}

// Game-core/backend hooks: update visual state only; no movement or collision rules live here.
export function updatePlayerPosition(id, position) {
    updateGamePlayer(id, position);
}

export function updatePlayerAnimation(id, animation, direction = "front") {
    updateGamePlayer(id, {
        animation,
        direction
    });
}

export function updateHUD(values) {
    const state = getUIState();
    uiStore?.setState({
        game: {
            ...state.game,
            hud: {
                ...state.game.hud,
                ...values
            }
        }
    });
}

export function setPowerUps(powerUps) {
    const state = getUIState();
    uiStore?.setState({
        game: {
            ...state.game,
            powerUps
        }
    });
}

function updateGamePlayer(id, changes) {
    const state = getUIState();
    const players = state.game.players.map((player) => {
        if (player.id === id) {
            return {
                ...player,
                ...changes
            };
        }

        return player;
    });

    uiStore?.setState({
        game: {
            ...state.game,
            players
        }
    });
}

function buildPreviewPlayers(lobbyPlayers) {
    const spawns = [
        { col: 1, row: 1 },
        { col: 13, row: 1 },
        { col: 1, row: 11 },
        { col: 13, row: 11 }
    ];

    return lobbyPlayers.map((player, index) => {
        return {
            ...player,
            ...spawns[index],
            direction: "front",
            animation: "idle"
        };
    });
}
