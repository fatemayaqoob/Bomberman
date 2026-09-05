import { getArenaGrid, MAP_HEIGHT, MAP_WIDTH } from "./map-renderer.js";

export const GAME_CONSTANTS = Object.freeze({
    bombFuseSeconds: 2.2,
    flameSeconds: 0.55,
    respawnSeconds: 1,
    moveCooldownSeconds: 0.12,
    maxBombs: 8,
    maxFlame: 8,
    maxSpeed: 5,
    dropChance: 0.35
});

const DIRECTIONS = {
    move_up: { row: -1, col: 0, facing: "back" },
    move_down: { row: 1, col: 0, facing: "front" },
    move_left: { row: 0, col: -1, facing: "left" },
    move_right: { row: 0, col: 1, facing: "right" }
};

const POWER_UP_TYPES = ["bomb", "flame", "speed"];
const SPAWNS = [
    { row: 1, col: 1 },
    { row: 1, col: MAP_WIDTH - 2 },
    { row: MAP_HEIGHT - 2, col: 1 },
    { row: MAP_HEIGHT - 2, col: MAP_WIDTH - 2 }
];

// The engine is deliberately DOM-free: it is deterministic when given a random
// function and can be shared by a future websocket-authoritative server.
export function createGameEngine({ players = [], random = Math.random, grid = getArenaGrid(random) } = {}) {
    let nextID = 1;
    const spawns = shuffledSpawns(random);
    let state = {
        grid: cloneGrid(grid),
        players: players.slice(0, 4).map((player, index) => createPlayer(player, index, spawns[index])),
        bombs: [],
        explosions: [],
        powerUps: [],
        gameOver: null,
        revision: 0
    };

    function getState() {
        return state;
    }

    // Multiplayer snapshots are produced by the existing game engine on the
    // acting client and relayed by the match server. Replacing this state lets
    // every client continue using the same engine/rendering path.
    function replaceState(nextState) {
        if (!nextState || !Array.isArray(nextState.grid) || !Array.isArray(nextState.players)) {
            return false;
        }
        state = {
            ...state,
            ...nextState,
            grid: cloneGrid(nextState.grid),
            players: nextState.players.map((player) => ({ ...player })),
            bombs: (nextState.bombs ?? []).map((bomb) => ({ ...bomb })),
            explosions: (nextState.explosions ?? []).map((explosion) => ({ ...explosion })),
            powerUps: (nextState.powerUps ?? []).map((powerUp) => ({ ...powerUp }))
        };
        return true;
    }

    function removePlayer(playerID) {
        const players = state.players.filter((player) => player.id !== playerID);
        if (players.length === state.players.length) return false;
        state = { ...state, players, revision: state.revision + 1 };
        return true;
    }

    function handleInput(playerID, action) {
        const player = findPlayer(playerID);
        if (state.gameOver || !player?.alive) {
            return false;
        }

        const collected = collectPowerUp(player);

        if (action === "place_bomb") {
            return placeBomb(playerID);
        }

        const direction = DIRECTIONS[action];
        if (!direction) {
            if (collected) {
                commit();
            }
            return false;
        }

        player.direction = direction.facing;
        if (player.moveCooldown > 0) {
            commit();
            return false;
        }

        const target = { row: player.row + direction.row, col: player.col + direction.col };
        if (!isWalkable(target.row, target.col, player)) {
            commit();
            return false;
        }

        player.row = target.row;
        player.col = target.col;
        // Keep the existing standing sprite while the renderer moves the grid
        // cell. This avoids swapping image assets during each key repeat.
        player.animation = "standing";
        player.moveCooldown = GAME_CONSTANTS.moveCooldownSeconds / player.speed;
        collectPowerUp(player);
        commit();
        return true;
    }

    function update(deltaSeconds) {
        if (!Number.isFinite(deltaSeconds) || deltaSeconds <= 0 || state.gameOver) {
            return false;
        }

        const delta = Math.min(deltaSeconds, 0.1);
        let changed = false;
        let visualChanged = false;
        for (const player of state.players) {
            if (player.alive && collectPowerUp(player)) {
                changed = true;
                visualChanged = true;
            }
            if (player.moveCooldown > 0) {
                player.moveCooldown = Math.max(0, player.moveCooldown - delta);
                changed = true;
            }
            if (!player.alive && player.respawnTimer > 0) {
                player.respawnTimer -= delta;
                if (player.respawnTimer <= 0 && player.lives > 0) {
                    respawn(player);
                    collectPowerUp(player);
                    visualChanged = true;
                }
                changed = true;
            }
            if (player.invulnerableFor > 0) {
                player.invulnerableFor = Math.max(0, player.invulnerableFor - delta);
                changed = true;
            }
        }

        for (const row of state.grid) {
            for (const tile of row) {
                if (tile.type !== "block" || tile.breakingFor === undefined) {
                    continue;
                }

                tile.breakingFor -= delta;
                changed = true;
                visualChanged = true;
                if (tile.breakingFor <= 0) {
                    destroyBlock(tile);
                }
            }
        }

        for (const bomb of [...state.bombs]) {
            bomb.fuse -= delta;
            if (bomb.fuse <= 0) {
                explodeBomb(bomb);
                changed = true;
                visualChanged = true;
            }
        }

        for (const explosion of [...state.explosions]) {
            damagePlayersAt(explosion.row, explosion.col);
            explosion.remaining -= delta;
            if (explosion.remaining <= 0) {
                state.explosions.splice(state.explosions.indexOf(explosion), 1);
                changed = true;
                visualChanged = true;
            }
        }

        if (changed) {
            commit();
        }
        return visualChanged;
    }

    function placeBomb(playerID) {
        const player = findPlayer(playerID);
        if (!player || !player.alive || activeBombsFor(playerID) >= player.bombs) {
            return false;
        }
        if (bombAt(player.row, player.col)) {
            return false;
        }
        state.bombs.push({
            id: `bomb-${nextID++}`,
            ownerID: playerID,
            row: player.row,
            col: player.col,
            flame: player.flame,
            fuse: GAME_CONSTANTS.bombFuseSeconds
        });
        commit();
        return true;
    }

    function explodeBomb(bomb) {
        const index = state.bombs.indexOf(bomb);
        if (index !== -1) {
            state.bombs.splice(index, 1);
        }
        const tiles = calculateExplosionTiles(bomb.row, bomb.col, bomb.flame);
        for (const tile of tiles) {
            state.explosions.push({ id: `flame-${nextID++}`, ...tile, remaining: GAME_CONSTANTS.flameSeconds });
            damagePlayersAt(tile.row, tile.col);
        }
    }

    // Rays stop at hard walls and damage exactly one soft block.
    function calculateExplosionTiles(row, col, range) {
        const tiles = [{ row, col }];
        for (const direction of Object.values(DIRECTIONS)) {
            for (let step = 1; step <= range; step += 1) {
                const targetRow = row + direction.row * step;
                const targetCol = col + direction.col * step;
                const tile = tileAt(targetRow, targetCol);
                if (!tile || tile.type === "wall" || tile.type === "trim") {
                    break;
                }
                tiles.push({ row: targetRow, col: targetCol });
                const chainedBomb = bombAt(targetRow, targetCol);
                if (chainedBomb) {
                    explodeBomb(chainedBomb);
                }
                if (tile.type === "block") {
                    damageBlock(tile);
                    break;
                }
            }
        }
        return tiles;
    }

    function damageBlock(tile) {
        tile.hitsRemaining = Math.max(0, (tile.hitsRemaining ?? 1) - 1);
        if (tile.hitsRemaining > 0) {
            tile.variant = "block3";
            return;
        }

        tile.breakingFor = GAME_CONSTANTS.flameSeconds;
        tile.variant = "block4";
    }

    function destroyBlock(tile) {
        tile.type = "ground";
        tile.variant = null;
        tile.hitsRemaining = 0;
        delete tile.breakingFor;
        tile.decoration = null;
        if (random() < GAME_CONSTANTS.dropChance) {
            const dropPosition = isWalkable(tile.row, tile.column, null, true)
                ? { row: tile.row, col: tile.column }
                : adjacentGround({ row: tile.row, col: tile.column }, null);
            if (!dropPosition) {
                return;
            }

            state.powerUps.push({
                id: `power-up-${nextID++}`,
                type: POWER_UP_TYPES[Math.floor(random() * POWER_UP_TYPES.length)],
                row: dropPosition.row,
                col: dropPosition.col
            });
        }
    }

    function damagePlayersAt(row, col) {
        for (const player of state.players) {
            if (player.alive && player.invulnerableFor <= 0 && player.row === row && player.col === col) {
                player.lives -= 1;
                player.alive = false;
                player.animation = "standing";
                player.respawnPosition = { row: player.row, col: player.col };
                player.respawnTimer = player.lives > 0 ? GAME_CONSTANTS.respawnSeconds : 0;
                player.invulnerableFor = GAME_CONSTANTS.respawnSeconds;
            }
        }
        determineWinner();
    }

    function determineWinner() {
        const contenders = state.players.filter((player) => player.lives > 0);
        if (state.players.length > 1 && contenders.length <= 1) {
            state.gameOver = {
                winnerID: contenders[0]?.id ?? null,
                message: contenders[0] ? `${contenders[0].nickname} wins!` : "No winner"
            };
        }
    }

    function respawn(player) {
        const respawnPosition = player.respawnPosition ?? player.spawn;
        player.row = respawnPosition.row;
        player.col = respawnPosition.col;
        player.alive = true;
        player.respawnTimer = 0;
        if (!isWalkable(player.row, player.col, player, true)) {
            const fallback = adjacentGround(respawnPosition, player);
            if (fallback) {
                player.row = fallback.row;
                player.col = fallback.col;
            }
        }
    }

    function collectPowerUp(player) {
        const powerUp = state.powerUps.find((item) => item.row === player.row && item.col === player.col);
        if (!powerUp) return false;
        state.powerUps.splice(state.powerUps.indexOf(powerUp), 1);
        if (powerUp.type === "bomb") player.bombs = Math.min(GAME_CONSTANTS.maxBombs, player.bombs + 1);
        if (powerUp.type === "flame") player.flame = Math.min(GAME_CONSTANTS.maxFlame, player.flame + 1);
        if (powerUp.type === "speed") player.speed = Math.min(GAME_CONSTANTS.maxSpeed, player.speed + 0.25);
        return true;
    }

    function isWalkable(row, col, movingPlayer, ignorePlayers = false) {
        const tile = tileAt(row, col);
        if (!tile || tile.type !== "ground") return false;
        const bomb = bombAt(row, col);
        if (bomb && !(bomb.ownerID === movingPlayer?.id && movingPlayer.row === row && movingPlayer.col === col)) return false;
        return ignorePlayers || !state.players.some((player) => player.alive && player.id !== movingPlayer?.id && player.row === row && player.col === col);
    }

    function adjacentGround(position, player) {
        return Object.values(DIRECTIONS)
            .map((direction) => ({ row: position.row + direction.row, col: position.col + direction.col }))
            .find((tile) => isWalkable(tile.row, tile.col, player));
    }

    function tileAt(row, col) {
        return state.grid[row]?.[col] ?? null;
    }

    function bombAt(row, col) {
        return state.bombs.find((bomb) => bomb.row === row && bomb.col === col);
    }

    function activeBombsFor(playerID) {
        return state.bombs.filter((bomb) => bomb.ownerID === playerID).length;
    }

    function findPlayer(id) {
        return state.players.find((player) => player.id === id);
    }

    function commit() {
        state = { ...state, revision: state.revision + 1 };
    }

    return { getState, replaceState, removePlayer, handleInput, update, placeBomb, calculateExplosionTiles };
}

function createPlayer(player, spawnIndex, spawn = SPAWNS[spawnIndex]) {
    return {
        ...player,
        row: spawn.row,
        col: spawn.col,
        spawnIndex,
        spawn,
        lives: 3,
        bombs: 1,
        flame: 1,
        speed: 1,
        direction: "front",
        animation: "standing",
        alive: true,
        moveCooldown: 0,
        respawnTimer: 0,
        invulnerableFor: 0
    };
}

function shuffledSpawns(random) {
    const spawns = SPAWNS.map((spawn) => ({ ...spawn }));

    for (let index = spawns.length - 1; index > 0; index -= 1) {
        const swapIndex = Math.floor(random() * (index + 1));
        [spawns[index], spawns[swapIndex]] = [spawns[swapIndex], spawns[index]];
    }

    return spawns;
}

function cloneGrid(grid) {
    return grid.map((row) => row.map((tile) => ({ ...tile })));
}
