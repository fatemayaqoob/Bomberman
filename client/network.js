import {
    applyChatMessage,
    applyLobbyState,
    applyMatchState,
    applySharedGameState,
    applyPlayerState,
    applyServerError,
    leaveCurrentGame,
    setConnectionState,
    submitNickname
} from "./ui-state.js";

let socket = null;

export function connectToServer(nickname) {
    if (socket?.readyState === WebSocket.OPEN || socket?.readyState === WebSocket.CONNECTING) {
        return;
    }

    if (!submitNickname(nickname)) {
        return;
    }

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    socket = new WebSocket(`${protocol}//${window.location.host}/ws`);
    setConnectionState("connecting");

    socket.addEventListener("open", () => {
        setConnectionState("connected");
        socket.send(JSON.stringify({ nickname, hat: getSelectedHat() }));
    });

    socket.addEventListener("message", (event) => {
        try {
            handleMessage(JSON.parse(event.data));
        } catch {
            applyServerError("Received an invalid server message.");
        }
    });

    socket.addEventListener("close", () => {
        setConnectionState("disconnected");
        // The server removes this connection from its authoritative roster.
        // Stop the local runtime too, so a closed tab/connection never leaves
        // a stale local match view running.
        if (window.location.hash === "#/game") {
            leaveCurrentGame();
        }
    });
    socket.addEventListener("error", () => applyServerError("Could not connect to the game server."));
}

export function leaveServer() {
    if (socket && socket.readyState < WebSocket.CLOSING) {
        socket.close(1000, "player left");
    }
    socket = null;
}

function getSelectedHat() {
    try {
        const raw = window.sessionStorage.getItem("bomberman-session");
        return JSON.parse(raw)?.localPlayer?.hat ?? "none";
    } catch {
        return "none";
    }
}

export function sendPlayerMove({ col, row, direction }) {
    send({ type: "player_move", x: col, y: row, direction: toServerDirection(direction) });
}

export function sendSharedGameState(state) {
    return send({ type: "game_state", state });
}

export function requestPlayAgain() {
    return send({ type: "play_again" });
}

export function sendChatMessage(message) {
    return send({ type: "chat_message", message });
}

function send(message) {
    if (!socket || socket.readyState !== WebSocket.OPEN) {
        return false;
    }

    socket.send(JSON.stringify(message));
    return true;
}

function handleMessage(message) {
    switch (message.type) {
        case "lobby_state":
            applyLobbyState(message);
            break;
        case "match_state":
            applyMatchState(message);
            break;
        case "game_state":
            applySharedGameState(message.state);
            break;
        case "player_state":
            applyPlayerState(message.players);
            break;
        case "chat_message":
            applyChatMessage(message);
            break;
        case "error":
            applyServerError(message.message ?? "Server error.");
            break;
        default:
            console.debug("Unhandled server message", message);
    }
}

function toServerDirection(direction) {
    return ({ front: "down", back: "up", left: "left", right: "right" })[direction] ?? "idle";
}
