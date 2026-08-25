const TILE_TYPES = {
    0: "empty",
    1: "wall",
    2: "block",
    empty: "empty",
    wall: "wall",
    block: "block"
};

export function mapToTiles(map = []) {
    return map.flatMap((row, rowIndex) =>
        row.map((tile, columnIndex) => ({
            row: rowIndex,
            column: columnIndex,
            type: normalizeTile(tile)
        }))
    );
}

export function applyMapSnapshot(store, map) {
    store.setState({
        game: {
            ...store.getState().game,
            map
        }
    });
}

export function destroyBlock(store, row, column) {
    const currentMap = store.getState().game.map;

    if (!currentMap[row] || currentMap[row][column] === undefined) {
        return;
    }

    const nextMap = currentMap.map((mapRow, rowIndex) =>
        rowIndex === row
            ? mapRow.map((tile, columnIndex) =>
                columnIndex === column ? "empty" : tile
            )
            : mapRow
    );

    applyMapSnapshot(store, nextMap);

    // TODO: trigger a destruction animation/power-up reveal after server rules are known.
}

function normalizeTile(tile) {
    if (typeof tile === "object" && tile !== null) {
        return TILE_TYPES[tile.type] ?? "empty";
    }

    return TILE_TYPES[tile] ?? "empty";
}