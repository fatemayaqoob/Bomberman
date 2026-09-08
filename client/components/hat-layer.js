import { element } from "../../framework/element.js";
import { HAT_DETAILS, getHatOffset } from "../game/cosmetics.js";

export function HatLayer({ players = [], lobbyPlayers = [] }) {
    const hatsByPlayer = new Map(lobbyPlayers.map((player) => [player.id, player.hat]));
    return element("div", { className: "hat-layer", "aria-hidden": true },
        players.map((player) => {
            const hat = hatsByPlayer.get(player.id);
            const asset = HAT_DETAILS[hat]?.asset;
            if (!asset) return null;
            const offset = getHatOffset(hat, player);
            return element("img", {
                className: `player-hat player-hat--${hat}`,
                src: asset,
                alt: "",
                draggable: false,
                style: `--col: ${player.col + 1}; --row: ${player.row + 1}; --hat-top: ${offset.top}; --hat-left: ${offset.left}; --hat-width: ${offset.width};`
            });
        })
    );
}
