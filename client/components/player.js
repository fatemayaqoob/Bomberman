import { element } from "../../framework/element.js";

const DIRECTIONS = new Set(["front", "back", "left", "right"]);

export function Player({ player }) {
    const direction = DIRECTIONS.has(player.direction)
        ? player.direction
        : "front";
    const animation = player.animation === "walking"
        ? "walking"
        : "standing";
    const frame = player.frame === 2 ? "2" : "";

    return element(
        "div",
        {
            className: `arena-player arena-player--${animation}`,
            "data-player-id": player.id,
            "data-player-slot": player.slot,
            style: `--col: ${player.col + 1}; --row: ${player.row + 1};`
        },
        element("img", {
            src: `/static/assets/player/${animation}/${direction}${frame}.png`,
            alt: player.nickname ?? "Player",
            draggable: false
        }),
        element(
            "span",
            { className: "arena-player__label" },
            player.nickname ?? "Player"
        )
    );
}
