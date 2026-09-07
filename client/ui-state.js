import { startGameRuntime } from "./game/runtime.js";
import { HAT_IDS } from "./game/cosmetics.js";
import { createSeededRandom, getArenaGridForSeed } from "./game/map-renderer.js";
import { sendPlayerMove, sendSharedGameState } from "./network.js";

const SESSION_KEY = "bomberman-session";

let uiStore = null;
let stopGameRuntime = null;
let countdownDisplayTimer = null;

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
            players: [],
            phase: "waiting",
            secondsRemaining: 20,
            countdownEndsAt: null
        },
        connection: { status: "idle", error: null },
        multiplayer: { players: [] },
        game: {
            matchPlayers: [],
            matchSeed: null,
            grid: [],
            players: [],
            powerUps: [],
            gameOver: null,
            notice: null,
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

// Change the visible screen and keep the hash route synchronized. The hash
// is updated first so the router already reports the new route by the time
// this store update triggers a render (hashchange fires asynchronously).
export function setScreen(screen) {
    window.location.hash = `/${screen}`;
    uiStore?.setState({ screen });
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
    persistSession();

    return true;
}

// Applies the server lobby snapshot directly to the real UI.
export function applyLobbyState(snapshot) {
    const state = getUIState();
    const players = (snapshot.players ?? []).slice(0, MAX_PLAYERS).map((player, slot) => ({
        ...player,
        slot,
        hat: HAT_IDS.includes(player.hat) ? player.hat : "none"
    }));

    const phase = snapshot.state ?? "waiting";
    const countdownEndsAt = snapshot.countdown_ends_at ?? null;
    const secondsRemaining = phase === "countdown" && countdownEndsAt
        ? Math.max(0, Math.ceil((Date.parse(countdownEndsAt) - Date.now()) / 1000))
        : snapshot.countdown_seconds ?? (phase === "countdown" ? state.lobby.secondsRemaining : 20);

    const localServerPlayer = players.find((player) => player.id === snapshot.self_id)
        ?? players.find((player) => player.nickname === state.localPlayer.nickname);
    const localPlayer = localServerPlayer
        ? { ...state.localPlayer, id: localServerPlayer.id, hat: localServerPlayer.hat }
        : state.localPlayer;

    uiStore?.setState({
        localPlayer,
        lobby: { ...state.lobby, players, phase, secondsRemaining, countdownEndsAt },
        game: snapshot.match_seed
            ? { ...state.game, matchSeed: snapshot.match_seed }
            : state.game
    });

    if (phase === "countdown" && countdownEndsAt) startCountdownDisplay(countdownEndsAt);
    else stopCountdownDisplay();

    if (state.screen === "game") {
        stopRunningGame();
    }
    if (state.screen !== "lobby") setScreen("lobby");

    persistSession();
}

// Active-match snapshots never include next-match waiting players. This keeps
// the current game roster stable while another lobby fills for the next game.
export function applyMatchState(snapshot) {
    const state = getUIState();
    const matchPlayers = (snapshot.players ?? []).slice(0, MAX_PLAYERS).map((player, slot) => ({
        ...player,
        slot,
        hat: HAT_IDS.includes(player.hat) ? player.hat : "none"
    }));
    const local = matchPlayers.find((player) => player.id === snapshot.self_id);
    uiStore?.setState({
        localPlayer: local ? { ...state.localPlayer, id: local.id, hat: local.hat } : state.localPlayer,
        game: {
            ...state.game,
            matchPlayers,
            matchSeed: snapshot.match_seed ?? state.game.matchSeed
        }
    });
    enterGame();
}

export function setConnectionState(status) {
    const state = getUIState();
    uiStore?.setState({
        connection: { ...state.connection, status, error: status === "connected" ? null : state.connection.error }
    });
}

export function applyServerError(error) {
    const state = getUIState();
    uiStore?.setState({ connection: { ...state.connection, status: "error", error } });
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

export function enterGame() {
    if (getUIState().screen === "game" && stopGameRuntime) return;

    stopRunningGame();
    const state = getUIState();
    const players = state.game.matchPlayers.length
        ? state.game.matchPlayers
        : state.lobby.players.length
        ? state.lobby.players
        : [{ id: state.localPlayer.id, nickname: state.localPlayer.nickname || "Player 1", slot: 0 }];
    const grid = state.game.matchSeed ? getArenaGridForSeed(state.game.matchSeed) : undefined;
    stopGameRuntime = startGameRuntime({
        players,
        grid,
        random: state.game.matchSeed ? createSeededRandom(state.game.matchSeed) : undefined,
        localPlayerID: state.localPlayer.id,
        localPlayerNickname: state.localPlayer.nickname,
        onLocalPosition: sendPlayerMove,
        onSharedState: sendSharedGameState,
        onStateChange: (engineState, visualItems) => {
            const current = getUIState();
            const local = engineState.players.find((player) => player.id === current.localPlayer.id)
                ?? engineState.players.find((player) => player.nickname === current.localPlayer.nickname)
                ?? engineState.players[0];
            uiStore?.setState({
                game: {
                    ...current.game,
                    grid: engineState.grid,
                    players: mergeNetworkPlayers(
                        engineState.players,
                        current.multiplayer.players
                    ).filter((player) => player.alive),
                    powerUps: visualItems,
                    gameOver: engineState.gameOver,
                    notice: local?.alive === false
                        ? (local.lives > 0 ? "YOU LOST A LIFE" : "YOU LOST")
                        : null,
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

export function applySharedGameState(sharedState) {
    if (!sharedState || !Array.isArray(sharedState.grid) || !Array.isArray(sharedState.players)) {
        return;
    }
    stopGameRuntime?.applySharedState?.(sharedState);
    const state = getUIState();
    const local = sharedState.players.find((player) => player.id === state.localPlayer.id);
    const visualItems = [
        ...(sharedState.powerUps ?? []),
        ...(sharedState.bombs ?? []).map((bomb) => ({ ...bomb, type: "placed-bomb" })),
        ...(sharedState.explosions ?? []).map((explosion) => ({ ...explosion, type: "placed-explosion" }))
    ];
    uiStore?.setState({
        game: {
            ...state.game,
            grid: sharedState.grid,
            players: sharedState.players.filter((player) => player.alive),
            powerUps: visualItems,
            gameOver: sharedState.gameOver ?? null,
            notice: local?.alive === false
                ? (local.lives > 0 ? "YOU LOST A LIFE" : "YOU LOST")
                : null,
            hud: local ? {
                ...state.game.hud,
                lives: local.lives,
                bombs: local.bombs,
                flame: local.flame,
                speed: local.speed
            } : state.game.hud
        }
    });
}

export function leaveCurrentGame() {
    stopRunningGame();
    const state = getUIState();
    uiStore?.setState({
        game: {
            ...state.game,
            grid: [],
            players: [],
            powerUps: [],
            gameOver: null,
            notice: null,
            matchSeed: null,
            matchPlayers: []
        }
    });
    setScreen("nickname");
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

export function applyPlayerState(players = []) {
    const state = getUIState();
    const normalized = players.map((player) => ({
        id: player.id,
        nickname: player.nickname,
        col: Math.round(player.x),
        row: Math.round(player.y),
        direction: toClientDirection(player.direction),
        animation: "standing",
        alive: player.alive
    }));

    // The engine's own roster (not the already-filtered render list) is used
    // as the merge baseline so an eliminated player is recognized as known
    // and never re-added just because this position-only sync still lists them.
    const roster = stopGameRuntime?.getPlayers?.() ?? state.game.players;

    uiStore?.setState({
        multiplayer: { ...state.multiplayer, players: normalized },
        game: state.screen === "game"
            ? { ...state.game, players: mergeNetworkPlayers(roster, normalized).filter((player) => player.alive) }
            : state.game
    });

    const knownIDs = new Set(normalized.map((player) => player.id));
    // Sweep the engine's full roster (not the alive-only render list) so a
    // disconnected player is removed even if they were already eliminated.
    for (const player of roster) {
        if (!knownIDs.has(player.id)) {
            stopGameRuntime?.removePlayer?.(player.id);
        }
    }
}

export function applyChatMessage(message) {
    const state = getUIState();
    uiStore?.setState({ chat: {
        ...state.chat,
        unread: state.chat.open ? 0 : state.chat.unread + 1,
        messages: [...state.chat.messages, {
            id: `${Date.now()}-${Math.random()}`,
            author: message.nickname ?? "PLAYER",
            text: message.message ?? ""
        }].slice(-30)
    } });
}

// Game-core/UI hooks: update rendered state without changing engine rules.
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

// Unions the locally-known match roster with the latest network snapshot so a
// player already known to be in the match is never dropped just because a
// given broadcast is momentarily partial/stale; it only gets updated in place.
// Eliminated players are never revived: the position-only sync channel has no
// concept of death, so a locally-dead player must keep overriding it.
function mergeNetworkPlayers(currentPlayers, networkPlayers) {
    if (!networkPlayers.length) return currentPlayers;

    const networkByID = new Map(networkPlayers.map((player) => [player.id, player]));
    const merged = currentPlayers.map((player) => (
        player.alive === false ? player : { ...player, ...networkByID.get(player.id) }
    ));

    const knownIDs = new Set(currentPlayers.map((player) => player.id));
    for (const networkPlayer of networkPlayers) {
        if (!knownIDs.has(networkPlayer.id)) {
            merged.push(networkPlayer);
        }
    }

    return merged;
}

function toClientDirection(direction) {
    return ({ up: "back", down: "front", left: "left", right: "right" })[direction] ?? "front";
}

function startCountdownDisplay(countdownEndsAt) {
    stopCountdownDisplay();
    countdownDisplayTimer = window.setInterval(() => {
        const state = getUIState();
        const secondsRemaining = Math.max(0, Math.ceil((Date.parse(countdownEndsAt) - Date.now()) / 1000));
        if (state.lobby.phase !== "countdown" || secondsRemaining <= 0) {
            stopCountdownDisplay();
            return;
        }
        uiStore?.setState({
            lobby: { ...state.lobby, secondsRemaining }
        });
    }, 1000);
}

function stopCountdownDisplay() {
    if (countdownDisplayTimer !== null) {
        window.clearInterval(countdownDisplayTimer);
        countdownDisplayTimer = null;
    }
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
