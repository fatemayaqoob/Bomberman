import { element } from "../../framework/element.js";

const VALID_ANIMATIONS = new Set(["idle", "walking", "placing-bomb", "dying"]);

export function Player({ player, isLocal = false }) {
    const animation = VALID_ANIMATIONS.has(player.animation)
        ? player.animation
        : "idle";

    const x = player.x ?? 0;
    const y = player.y ?? 0;

    return element("div", {
        className: [
            "player",
            `player--${animation}`,
            isLocal ? "player--local" : ""
        ].filter(Boolean).join(" "),
        "data-player-id": player.id ?? "",
        "data-direction": player.direction ?? "down",
        style: `transform: translate(${x}px, ${y}px);`
    },
    // TODO: add sprite-sheet frame selection and timing after animation rules are settled.
    element("span", { className: "player__name" }, player.nickname ?? player.name ?? "Player")
    );
}