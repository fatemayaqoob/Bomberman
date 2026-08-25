import { element } from "../../framework/element.js";
import { mapToTiles } from "../game/map-renderer.js";

export function Map({ map }) {
    const tiles = mapToTiles(map);

    return element(
        "div",
        { className: "map", id: "game-map", role: "grid" },
        tiles.map((tile) =>
            element(
                "div",
                {
                    className: `map__tile map__tile--${tile.type}`,
                    role: "gridcell",
                    "data-row": tile.row,
                    "data-column": tile.column
                },
                // TODO: Add tile artwork/textures for walls, destructible blocks, and floor tiles.
                // TODO: Add a block destruction animation asset/state when a block changes to empty.
                element("span", { className: "map__tile-art", "aria-hidden": true })
            )
        )
    );
}
