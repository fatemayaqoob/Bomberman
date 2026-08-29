import { element } from "../../framework/element.js";
import { getArenaGrid, mapToTiles } from "../game/map-renderer.js";

// Keep the board layout stable while state updates patch other game layers.
const ARENA_GRID = getArenaGrid();

export function Map() {
    return element(
        "div",
        {
            className: "arena-grid",
            role: "grid",
            "aria-label": "Fixed game arena"
        },
        mapToTiles(ARENA_GRID).map((tile) => {
            const variantClass = tile.variant
                ? ` arena-tile--${tile.variant}`
                : "";
            const decoration = tile.decoration
                ? element("span", {
                    className: `arena-decoration arena-decoration--${tile.decoration}`,
                    "aria-hidden": true
                })
                : null;

            return element(
                "div",
                {
                    className: `arena-tile arena-tile--${tile.type}${variantClass}`,
                    role: "gridcell",
                    "data-row": tile.row,
                    "data-column": tile.column
                },
                decoration
            );
        })
    );
}
