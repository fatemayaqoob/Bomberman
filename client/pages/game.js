import { element } from "../../framework/element.js";
import { Map } from "../components/map.js";
import { Player } from "../components/player.js";
import { HUD } from "../components/hud.js";
import { PowerUpLayer } from "../components/powerups.js";

export function GamePage({ state }) {
    return element(
        "section",
        { className: "game-screen" },
        element(HUD, { stats: state.game.hud }),
        element(
            "div",
            { className: "arena-stage" },
            element(Map, {}),
            element(PowerUpLayer, { powerUps: state.game.powerUps }),
            element(
                "div",
                { className: "entity-layer", "aria-label": "Player preview" },
                state.game.players.map((player) => element(Player, { player }))
            )
        )
    );
}
