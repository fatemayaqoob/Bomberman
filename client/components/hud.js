import { element } from "../../framework/element.js";

export function HUD({ player, fps }) {
    const powerUps = player.powerUps ?? [];

    return element(
        "header",
        { className: "hud" },
        // TODO: Add a life/heart icon asset beside this value.
        element("span", { className: "hud__lives" }, `Lives: ${player.lives ?? 0}`),
        // TODO: Add a bomb icon asset beside this value.
        element("span", { className: "hud__bombs" }, `Bombs: ${player.bombs ?? 0}`),
        element("span", { className: "hud__fps" }, `FPS: ${fps ?? 0}`),
        element(
            "div",
            { className: "hud__power-ups" },
            element("strong", {}, "Power-ups: "),
            powerUps.length
                ? powerUps.map((powerUp) =>
                    // TODO: Add the correct icon asset for each power-up type.
                    element("span", { className: "hud__power-up", "data-power-up": powerUp }, powerUp)
                )
                : element("span", {}, "None")
        )
    );
}
