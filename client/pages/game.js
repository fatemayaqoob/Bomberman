import { element } from "../../framework/element.js";
import { Map } from "../components/map.js";
import { Player } from "../components/player.js";
import { HUD } from "../components/hud.js";
import { PowerUpLayer } from "../components/powerups.js";
import { HatLayer } from "../components/hat-layer.js";
import { Chat } from "../components/chat.js";
import { requestPlayAgain } from "../network.js";

export function GamePage({ state }) {
    const gameOver = state.game.gameOver;
    const notice = state.game.notice;
    
    return element(
        "section",
        { className: "game-screen" },
        element(HUD, { stats: state.game.hud, playerCount: state.game.players.length }),
        element(
            "div",
            { className: "arena-stage" },
            element(Map, { grid: state.game.grid }),
            element(PowerUpLayer, { powerUps: state.game.powerUps }),
            element(HatLayer, { players: state.game.players, lobbyPlayers: state.game.matchPlayers }),
            element(
                "div",
                { className: "entity-layer", "aria-label": "Player preview" },
                state.game.players.map((player) => element(Player, { player }))
            ),
            notice ? element("div", { className: "game-notice", role: "status" }, notice) : null,
            gameOver ? element(
                "div",
                { className: "game-over-overlay" },
                element("div", { className: "game-over-panel" },
                    element("h2", { className: "game-over-title" }, gameOver.message),
                    element("button", { type: "button", onClick: requestPlayAgain }, "PLAY AGAIN")
                )
            ) : null
        ),
        element(Chat, { chat: state.chat })
    );
}
