// Lightweight global store. It owns data changes, not rendering.

export function createStore(initialState = {}) {
    let state = { ...initialState };
    const listeners = new Set();

    function getState() {
        return state;
    }

    function setState(partialState = {}) {
        const nextPartialState = typeof partialState === "function"
            ? partialState(state)
            : partialState;

        if (!nextPartialState || typeof nextPartialState !== "object") {
            return state;
        }

        const nextState = {
            ...state,
            ...nextPartialState
        };

        if (shallowEqual(state, nextState)) {
            return state;
        }

        state = nextState;
        notify();
        return state;
    }

    function subscribe(listener) {
        if (typeof listener !== "function") {
            return () => {};
        }

        listeners.add(listener);
        return () => unsubscribe(listener);
    }

    function unsubscribe(listener) {
        listeners.delete(listener);
    }

    function notify() {
        for (const listener of [...listeners]) {
            listener(state);
        }
    }

    return {
        getState,
        setState,
        subscribe,
        unsubscribe
    };
}

function shallowEqual(left, right) {
    const leftKeys = Object.keys(left);
    const rightKeys = Object.keys(right);

    if (leftKeys.length !== rightKeys.length) {
        return false;
    }

    return leftKeys.every((key) => Object.is(left[key], right[key]));
}
