import { element } from "../../framework/element.js";
import { Map } from "../components/map.js";
import { Player } from "../components/player.js";
import { HUD } from "../components/hud.js";
import { Chat } from "../components/chat.js";
import { startGameLoop } from "../game/loop.js";
import { attachGameInput } from "../game/input.js";
import { EVENTS, sendSocketEvent } from "../main.js";

let stopLoop = null;
let detachInput = null;

export function GamePage({ state, store }) {
    if (state.game.active && !stopLoop) {
        startGameRuntime(store);
    }

    return element(
        "section",
        { className: "game-page" },
        // TODO: Add match background art and a start-of-match transition animation here.
        element(HUD, {
            player: state.player,
            fps: state.game.fps
        }),
        element(
            "div",
            { className: "game-board", id: "game-board" },
            element(Map, { map: state.game.map }),
            state.game.players.map((player) =>
                element(Player, {
                    player,
                    isLocal: player.id === state.player.id
                })
            )
        ),
        element(Chat, {
            messages: state.game.messages
        })
    );
}

function startGameRuntime(store) {
    detachInput = attachGameInput((input) => {
        // TODO: add client-side prediction only after collision and reconciliation rules are defined.
        sendSocketEvent(EVENTS.PLAYER_INPUT, input);
    });

    stopLoop = startGameLoop({
        update(deltaTime) {
            // TODO: non-authoritative client update work here
            // The backend should remain the source of truth for movement, bombs, and explosions.
            void deltaTime;
        },

        render() {
            // DOM rendering is currently triggered by store updates from WebSocket events.
            // TODO: add interpolation here if server needs smoothing
        },

        onFps(fps) {
            store.setState({
                game: {
                    ...store.getState().game,
                    fps
                }
            });
        }
    });
}

export function stopGameRuntime() {
    stopLoop?.();
    detachInput?.();
    stopLoop = null;
    detachInput = null;
}
