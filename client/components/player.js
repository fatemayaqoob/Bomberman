import { element } from "../../framework/element.js";

const VALID_ANIMATIONS = new Set(["idle", "walking", "placing-bomb", "dying"]);

export function Player({ player, isLocal = false }) {
    const animation = VALID_ANIMATIONS.has(player.animation)
        ? player.animation
        : "idle";

    const x = player.x ?? 0;
    const y = player.y ?? 0;

    return element(
        "div",
        {
            className: [
                "player",
                `player--${animation}`,
                isLocal ? "player--local" : ""
            ].filter(Boolean).join(" "),
            "data-player-id": player.id ?? "",
            "data-direction": player.direction ?? "down",
            style: `transform: translate(${x}px, ${y}px);`
        },
        // TODO: Add a player sprite-sheet/image and CSS frames for idle, walking, placing-bomb, and dying.
        element("span", { className: "player__sprite", "aria-hidden": true }),
        element("span", { className: "player__name" }, player.nickname ?? player.name ?? "Player")
    );
}
