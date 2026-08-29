import { element } from "../../framework/element.js";

const ASSETS = {
    bomb: "../static/assets/bomb/bomb1.png",
    flame: "../static/assets/explosion/explosion1.png"
};

// Render visual-only power-ups supplied by the UI state layer.
export function PowerUpLayer({ powerUps = [] }) {
    return element(
        "div",
        {
            className: "powerup-layer",
            "aria-label": "Power-up preview"
        },
        powerUps.map((powerUp) => {
            const asset = ASSETS[powerUp.type];
            const content = asset
                ? element("img", {
                    src: asset,
                    alt: `${powerUp.type} power-up`,
                    draggable: false
                })
                : element("span", { "aria-label": "speed power-up" }, "S+");

            return element(
                "div",
                {
                    className: `powerup powerup--${powerUp.type}`,
                    style: `--col: ${powerUp.col + 1}; --row: ${powerUp.row + 1};`
                },
                content
            );
        })
    );
}
