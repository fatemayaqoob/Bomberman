const KEY_TO_ACTION = {
    ArrowUp: "move_up",
    KeyW: "move_up",
    ArrowDown: "move_down",
    KeyS: "move_down",
    ArrowLeft: "move_left",
    KeyA: "move_left",
    ArrowRight: "move_right",
    KeyD: "move_right",
    Space: "place_bomb"
};

export function attachGameInput(sendInput) {
    const pressedActions = new Set();

    function onKeyDown(event) {
        const action = KEY_TO_ACTION[event.code];

        if (!action) {
            return;
        }

        event.preventDefault();

        if (pressedActions.has(action)) {
            return;
        }

        pressedActions.add(action);
        sendInput?.({ action, pressed: true });

        // TODO: decide whether bomb placement is edge-triggered or held by the backend
    }

    function onKeyUp(event) {
        const action = KEY_TO_ACTION[event.code];

        if (!action) {
            return;
        }

        event.preventDefault();
        pressedActions.delete(action);
        sendInput?.({ action, pressed: false });
    }

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);

    return function detachGameInput() {
        window.removeEventListener("keydown", onKeyDown);
        window.removeEventListener("keyup", onKeyUp);
        pressedActions.clear();
    };
}
