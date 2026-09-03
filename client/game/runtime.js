import { createGameEngine } from "./engine.js";
import { attachGameInput } from "./input.js";
import { startGameLoop } from "./loop.js";

// Connects the game engine to the existing keyboard and RAF helpers.
export function startGameRuntime({ players, localPlayerID, localPlayerNickname, onLocalPosition, onStateChange, onRestart, onFps }) {
    const engine = createGameEngine({ players });
    const activePlayers = engine.getState().players;
    const controlledPlayerID = activePlayers.find(({ id }) => id === localPlayerID)?.id
        ?? activePlayers.find(({ nickname }) => nickname === localPlayerNickname)?.id
        ?? activePlayers.find(({ slot }) => slot === 0)?.id
        ?? activePlayers[0]?.id;
    let lastRenderSignature = "";
    let lastSentPosition = "";

    function publish() {
        const state = engine.getState();
        const visualItems = [
            ...state.powerUps,
            ...state.bombs.map((bomb) => ({ ...bomb, type: "placed-bomb" })),
            ...state.explosions.map((explosion) => ({ ...explosion, type: "placed-explosion" }))
        ];
        const signature = JSON.stringify({
            grid: state.grid.map((row) => row.map(({ type, variant, hitsRemaining, breakingFor }) => ({ type, variant, hitsRemaining, breakingFor }))),
            players: state.players.map(({ id, row, col, direction, animation, alive, lives, bombs, flame, speed }) => ({ id, row, col, direction, animation, alive, lives, bombs, flame, speed })),
            items: visualItems.map(({ id, type, row, col }) => ({ id, type, row, col })),
            gameOver: state.gameOver
        });

        if (signature !== lastRenderSignature) {
            lastRenderSignature = signature;
            onStateChange?.({
                ...state,
                grid: state.grid.map((row) => row.map((tile) => ({ ...tile }))),
                players: state.players.map((player) => ({ ...player }))
            }, visualItems);
        }

        const controlledPlayer = state.players.find((player) => player.id === controlledPlayerID);
        if (controlledPlayer) {
            const position = `${controlledPlayer.col}:${controlledPlayer.row}:${controlledPlayer.direction}`;
            if (position !== lastSentPosition) {
                lastSentPosition = position;
                onLocalPosition?.({ col: controlledPlayer.col, row: controlledPlayer.row, direction: controlledPlayer.direction });
            }
        }
    }

    publish();
    const detachInput = attachGameInput(({ action, pressed }) => {
        if (pressed) {
            if (action === "restart_game") {
                // Only allow restart if game is over
                if (engine.getState().gameOver) {
                    onRestart?.();
                }
                return;
            }
            engine.handleInput(controlledPlayerID, action);
            publish();
        }
    });
    const stopLoop = startGameLoop({
        update: (delta) => {
            if (engine.update(delta)) {
                publish();
            }
        },
        onFps
    });

    return () => {
        detachInput();
        stopLoop();
    };
}
