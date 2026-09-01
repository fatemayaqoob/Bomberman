const KEY_TO_ACTION = {
    ArrowUp: "move_up",
    KeyW: "move_up",
    ArrowDown: "move_down",
    KeyS: "move_down",
    ArrowLeft: "move_left",
    KeyA: "move_left",
    ArrowRight: "move_right",
    KeyD: "move_right",
    Space: "place_bomb",
    KeyR: "restart_game"
};

const KEY_CODE_TO_ACTION = {
    37: "move_left",
    38: "move_up",
    39: "move_right",
    40: "move_down"
};

export function attachGameInput(sendInput) {
    const pressedActions = new Set();
    const inputTarget = document;

    function isTextInputFocused(event) {
        const target = event.target;
        return target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement;
    }

    function onKeyDown(event) {
        // Skip game input if user is typing in a text field
        if (isTextInputFocused(event)) {
            return;
        }

        const action = getAction(event);

        if (!action) {
            return;
        }

        event.preventDefault();

        // Bomb placement is edge-triggered; movement intentionally uses browser
        // key-repeat so holding an arrow keeps moving at the engine's speed cap.
        if ((action === "place_bomb" || action === "restart_game") && pressedActions.has(action)) {
            return;
        }

        pressedActions.add(action);
        sendInput?.({ action, pressed: true });

    }

    function onKeyUp(event) {
        // Skip game input if user is typing in a text field
        if (isTextInputFocused(event)) {
            return;
        }

        const action = getAction(event);

        if (!action) {
            return;
        }

        event.preventDefault();
        pressedActions.delete(action);
        sendInput?.({ action, pressed: false });
    }

    inputTarget.addEventListener("keydown", onKeyDown);
    inputTarget.addEventListener("keyup", onKeyUp);

    return function detachGameInput() {
        inputTarget.removeEventListener("keydown", onKeyDown);
        inputTarget.removeEventListener("keyup", onKeyUp);
        pressedActions.clear();
    };
}

function getAction(event) {
    return KEY_TO_ACTION[event.code]
        ?? KEY_TO_ACTION[event.key]
        ?? KEY_CODE_TO_ACTION[event.keyCode];
}
