import { startGameRuntime } from "./game/runtime.js";
import { HAT_IDS } from "./game/cosmetics.js";

const SESSION_KEY = "bomberman-session";

let uiStore = null;
let lobbyTimer = null;
let stopGameRuntime = null;

export const MAX_PLAYERS = 4;

export function createInitialUIState() {
    const savedSession = readSession();
    const localPlayer = {
        ...(savedSession?.localPlayer ?? {
            id: "player-1",
            nickname: "",
            lives: 3,
            bombs: 1,
            flame: 1,
            speed: 1
        }),
        hat: savedSession?.localPlayer?.hat ?? "none"
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
        },
        // UI-only chat preview. This intentionally has no external transport.
        chat: { open: false, unread: 0, messages: [] }
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
        nickname: cleanName,
        hat: chooseAvailableHat(state.localPlayer.hat, state.lobby.players, state.localPlayer.id)
    };

    uiStore?.setState({ localPlayer });
    setLobbyPlayers([
        {
            id: localPlayer.id,
            nickname: cleanName,
            slot: 0,
            hat: localPlayer.hat
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

// LOCAL HAT AVAILABILITY STUB: renders exclusivity from the current UI roster only.
// Replace this roster source later with a list whose player entries include { id, hat }.
export function getTakenHats(players = getUIState().lobby.players, excludeID = null) {
    return new Set(players.filter((player) => player.id !== excludeID && HAT_IDS.includes(player.hat)).map((player) => player.hat));
}

export function selectLocalHat(hat) {
    if (!HAT_IDS.includes(hat)) return false;
    const state = getUIState();
    if (getTakenHats(state.lobby.players, state.localPlayer.id).has(hat)) return false;
    const localPlayer = { ...state.localPlayer, hat };
    const players = state.lobby.players.map((player) => player.id === localPlayer.id ? { ...player, hat } : player);
    uiStore?.setState({ localPlayer, lobby: { ...state.lobby, players } });
    persistSession();
    return true;
}

function chooseAvailableHat(preferredHat, players, localPlayerID) {
    const taken = getTakenHats(players, localPlayerID);
    if (HAT_IDS.includes(preferredHat) && !taken.has(preferredHat)) return preferredHat;
    const available = HAT_IDS.filter((hat) => !taken.has(hat));
    return available[Math.floor(Math.random() * available.length)] ?? "none";
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

export function openChat() {
    const state = getUIState();
    uiStore?.setState({ chat: { ...state.chat, open: true, unread: 0 } });
}

export function closeChat() {
    const state = getUIState();
    uiStore?.setState({ chat: { ...state.chat, open: false } });
}

// Local-only UI preview until chat has an agreed message source.
export function sendLocalChatMessage(text) {
    const message = text.trim();
    if (!message) return false;
    const state = getUIState();
    uiStore?.setState({ chat: {
        ...state.chat,
        messages: [...state.chat.messages, { id: `${Date.now()}-${Math.random()}`, author: state.localPlayer.nickname || "YOU", text: message }].slice(-30)
    } });
    return true;
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
