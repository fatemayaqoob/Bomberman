export const TILE_SIZE = 48;
export const MAP_WIDTH = 15;
export const MAP_HEIGHT = 13;

const BLOCK_CHANCE = 0.52;

const DECORATIONS = [
    "flowers",
    "flowerpot",
    "grass",
    "grass1",
    "grass2",
    "grass3",
    "grass4"
];

const SPAWN_SAFE_TILES = new Set([
    "1,1",
    "1,2",
    "2,1",
    "1,13",
    "1,12",
    "2,13",
    "11,1",
    "11,2",
    "10,1",
    "11,13",
    "11,12",
    "10,13"
]);

// Create a static arena grid. A seeded random function can be supplied by tests.
export function getArenaGrid(random = Math.random) {
    return Array.from(
        { length: MAP_HEIGHT },
        (_, row) => Array.from(
            { length: MAP_WIDTH },
            (_, column) => createTile(row, column, random)
        )
    );
}

export function mapToTiles(map = getArenaGrid()) {
    return map.flat();
}

function createTile(row, column, random) {
    if (isOuterEdge(row, column)) {
        return {
            type: "trim",
            row,
            column,
            decoration: null,
            variant: "block1"
        };
    }

    if (row % 2 === 0 && column % 2 === 0) {
        return {
            type: "wall",
            row,
            column,
            decoration: null
        };
    }

    const isSafeSpawn = isSpawnSafe(row, column);
    const type = !isSafeSpawn && random() < BLOCK_CHANCE
        ? "block"
        : "ground";
    const variant = getBlockVariant(type, random);

    return {
        type,
        row,
        column,
        variant,
        hitsRemaining: getBlockHits(type, variant),
        breakingFor: undefined,
        decoration: getDecoration(type, isSafeSpawn, random)
    };
}

function getBlockVariant(type, random) {
    if (type !== "block") {
        return null;
    }

    return `block${1 + Math.floor(random() * 4)}`;
}

function getBlockHits(type, variant) {
    if (type !== "block") {
        return 0;
    }

    return variant === "block3" || variant === "block4" ? 1 : 2;
}

function getDecoration(type, isSafeSpawn, random) {
    if (type !== "ground" || isSafeSpawn || random() >= 0.13) {
        return null;
    }

    const decorationIndex = Math.floor(random() * DECORATIONS.length);
    return DECORATIONS[decorationIndex];
}

function isOuterEdge(row, column) {
    return row === 0 || column === 0 || row === MAP_HEIGHT - 1 || column === MAP_WIDTH - 1;
}

function isSpawnSafe(row, column) {
    return SPAWN_SAFE_TILES.has(`${row},${column}`);
}
