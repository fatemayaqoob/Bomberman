import { element } from "../../framework/element.js";

const ASSETS = {
    "placed-bomb": "/static/assets/bomb/bomb1.png",
    "placed-explosion": "/static/assets/explosion/explosion1.gif",
    bomb: "/static/assets/powerups/red-bomb-power-up.png",
    flame: "/static/assets/powerups/flame-draft.png",
    speed: "/static/assets/powerups/speed-power-up.png"
};

const LABELS = {
    bomb: "B+",
    speed: "S+",
    flame: "F+"
};

export function PowerUpLayer({ powerUps = [] }) {
    return element(
        "div",
        {
            className: "powerup-layer",
            "aria-label": "Power-up preview"
        },
        [
            ["collectible", powerUps.filter(({ type }) => LABELS[type])],
            ["bombs", powerUps.filter(({ type }) => type === "placed-bomb")],
            ["explosions", powerUps.filter(({ type }) => type === "placed-explosion")]
        ].map(([group, items]) => element(
            "div",
            { className: `powerup-group powerup-group--${group}` },
            items.map((powerUp) => renderPowerUp(powerUp))
        ))
    );
}

function renderPowerUp(powerUp) {
    const asset = ASSETS[powerUp.type];
    const content = asset
        ? element("img", {
            src: asset,
            alt: powerUp.type === "placed-bomb" ? "Placed bomb" : powerUp.type === "placed-explosion" ? "Explosion" : `${powerUp.type} power-up`,
            draggable: false
        })
        : element(
            "span",
            { "aria-label": `${powerUp.type} power-up` },
            LABELS[powerUp.type] ?? "?+"
        );

    return element(
        "div",
        {
            className: `powerup powerup--${powerUp.type}`,
            style: `--col: ${powerUp.col + 1}; --row: ${powerUp.row + 1};`,
            "data-item-id": powerUp.id
        },
        content
    );
}
