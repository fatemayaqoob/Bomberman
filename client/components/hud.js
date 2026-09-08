import { element } from "../../framework/element.js";

export function HUD({ stats, playerCount = 0 }) {
    return element(
        "header",
        { className: "hud" },
        element("div", { className: "hud__brand" }, "BOMBERMAN"),
        element(
            "div",
            { className: "hud__stats" },
            element("span", { className: "hud-stat hud-stat--lives" }, `LIVES ${stats.lives ?? 3}`),
            element("span", { className: "hud-stat hud-stat--bomb" }, `BOMBS ${stats.bombs ?? 1}`),
            element("span", { className: "hud-stat hud-stat--flame" }, `FLAME ${stats.flame ?? 1}`),
            element("span", { className: "hud-stat hud-stat--speed" }, `SPEED ${stats.speed ?? 1}`),
            element("span", { className: "hud-stat hud-stat--players" }, `PLAYERS ${playerCount} / 4`)
        )
    );
}
