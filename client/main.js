import { createApp } from "../framework/app.js";
import { element } from "../framework/element.js";
import { createRouter } from "../framework/router.js";
import { createStore } from "../framework/state.js";

import { NicknamePage } from "./pages/nickname.js";
import { LobbyPage } from "./pages/lobby.js";
import { GamePage } from "./pages/game.js";
import { applyMapSnapshot, destroyBlock } from "./game/map-renderer.js";

// TODO: replace these once the backend confirms the real
export const EVENTS = {
    NICKNAME_SUBMIT: "nickname_submit",
    NICKNAME_ACCEPTED: "nickname_accepted",
    LOBBY_STATE: "lobby_state",
    LOBBY_WAITING_STARTED: "lobby_waiting_started",
    LOBBY_READY_COUNTDOWN: "lobby_ready_countdown",
    MATCH_STARTED: "match_started",
    GAME_STATE: "game_state",
    BLOCK_DESTROYED: "block_destroyed",
    CHAT_SEND: "chat_send",
    CHAT_MESSAGE: "chat_message",
    PLAYER_INPUT: "player_input",
    ERROR: "error"
};

export const store = createStore({
    connection: {
        status: "connecting",
        error: null
    },
    player: {
        id: null,
        nickname: "",
        lives: 3,
        bombs: 1,
        powerUps: []
    },
    lobby: {
        players: [],
        phase: "waiting", // "waiting" or "ready"
        secondsRemaining: 20
    },
    game: {
        active: false,
        fps: 0,
        map: [],
        players: [],
        messages: []
    }
});

const router = createRouter({
    "/nickname": NicknamePage,
    "/lobby": LobbyPage,
    "/game": GamePage
})

let socket = null;
let lobbyClockId = null;

const wsProtocol = window.location.protocol === "https:" ? "wss:" : "ws:";
const WS_URL = window.BOMBERMAN_WS_URL ?? `${wsProtocol}//${window.location.hostname}:8080/ws`;

export function sendSocketEvent(type, payload = {}) {
    if (!socket || socket.readyState !== WebSocket.OPEN) {
        console.warn("WebSocket is not connected; event not sent:", type);
        return false;
    }

    socket.send(JSON.stringify({ type, ...payload }));
    return true;
}

export function connectBackend() {
    if (socket?.readyState === WebSocket.OPEN || socket?.readyState === WebSocket.CONNECTING) {
        return socket;
    }

    store.setState({
        connection: { status: "connecting", error: null }
    });

    socket = new WebSocket(WS_URL);

    // socket event listenres
    socket.addEventListener("open", () => {
        store.setState({
            connection: { status: "connected", error: null }
        });
    });

    socket.addEventListener("message", (event) => {
        try {
            handleServerEvent(JSON.parse(event.data));
        } catch (error) {
            console.error("Invalid WebSocket JSON:", error, event.data);
        }
    });

    socket.addEventListener("close", () => {
        stopLobbyClock();
        store.setState({
            connection: { status: "disconnected", error: "Connection closed." }
        });
    });

    socket.addEventListener("error", () => {
        store.setState({
            connection: { status: "error", error: "WebSocket connection failed." }
        });
    });

    return socket;
}

function handleServerEvent(message) {
    // TODO: matcj each branch to the exact event type and payload shape later
    switch (message.type) {
        case EVENTS.NICKNAME_ACCEPTED:
            store.setState({
                player: {
                    ...store.getState().player,
                    id: message.player?.id ?? null,
                    nickname: message.player?.nickname ?? store.getState().player.nickname
                },
                lobby: {
                    ...store.getState().lobby,
                    players: message.players ?? []
                }
            });
            router.navigate("/lobby");
            break;

        case EVENTS.LOBBY_STATE:
            store.setState({
                lobby: {
                    ...store.getState().lobby,
                    players: message.players ?? []
                }
            });
            break;

        case EVENTS.LOBBY_WAITING_STARTED:
            startLobbyClock("waiting", message.seconds ?? 20);
            break;

        case EVENTS.LOBBY_READY_COUNTDOWN:
            startLobbyClock("ready", message.seconds ?? 10);
            break;

        case EVENTS.MATCH_STARTED:
            stopLobbyClock();
            store.setState({
                game: {
                    ...store.getState().game,
                    active: true,
                    map: message.map ?? [],
                    players: message.players ?? []
                }
            });
            router.navigate("/game");
            break;

        case EVENTS.GAME_STATE:
            store.setState({
                game: {
                    ...store.getState().game,
                    players: message.players ?? store.getState().game.players
                }
            });
            if (message.map) {
                applyMapSnapshot(store, message.map);
            }
            break;

        case EVENTS.BLOCK_DESTROYED:
            // TODO: confirm if the server sends { row, column } or  another laterrr
            destroyBlock(store, message.row, message.column);
            break;

        case EVENTS.CHAT_MESSAGE:
            addChatMessage(message);
            break;

        case EVENTS.ERROR:
            store.setState({
                connection: {
                    ...store.getState().connection,
                    error: message.message ?? "Server error."
                }
            });
            break;

        default:
            console.debug("Unhandled backend event:", message);
    }
}

function addChatMessage(message) {
    //TODO: ensure it compiles with backend when the feature is done
    const currentMessages = store.getState().game.messages;

    store.setState({
        game: {
            ...store.getState().game,
            messages: [
                ...currentMessages,
                {
                    id: message.id ?? `${Date.now()}-${Math.random()}`,
                    sender: message.sender ?? "Server",
                    text: message.text ?? "",
                    sentAt: message.sentAt ?? Date.now()
                }
            ].slice(-100)
        }
    });
}

function startLobbyClock(phase, seconds) {
    const deadline = Date.now() + seconds * 1000;

    stopLobbyClock();

    const tick = () => {
        const secondsRemaining = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));

        store.setState({
            lobby: {
                ...store.getState().lobby,
                phase,
                secondsRemaining
            }
        });

        if (secondsRemaining === 0) {
            stopLobbyClock();
            // TODO: match start should still come from the backend
        }
    };

    tick();
    lobbyClockId = window.setInterval(tick, 250);
}

function stopLobbyClock() {
    if (lobbyClockId !== null) {
        window.clearInterval(lobbyClockId);
        lobbyClockId = null;
    }
}

function App({ route, state, store: appStore, router: appRouter }) {
    const pages = {
        "/nickname": NicknamePage,
        "/lobby": LobbyPage,
        "/game": GamePage
    };

    const Page = pages[route] ?? NicknamePage;

    return element(
        "main",
        { className: "bomberman-app" },
        element(Page, {
            state,
            store: appStore,
            router: appRouter
        })
    );
}

if (!window.location.hash) {
    router.navigate("/nickname");
}

createApp({
    root: "#app",
    component: App,
    store,
    router
});

connectBackend();