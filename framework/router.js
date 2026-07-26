// Small hash router for route-driven rendering.

let activeRouter = null;

export function createRouter(routes = {}) {
    activeRouter?.destroy?.();

    const listeners = new Set();

    function getCurrentRoute() {
        const path = getHashPath();

        if (routes[path] !== undefined || Object.keys(routes).length === 0) {
            return path;
        }

        return routes["/"] !== undefined ? "/" : path;
    }

    function navigate(path) {
        const nextPath = normalizePath(path);

        if (getHashPath() === nextPath) {
            notify();
            return;
        }

        window.location.hash = nextPath;
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
        const route = getCurrentRoute();

        for (const listener of [...listeners]) {
            listener(route);
        }
    }

    function destroy() {
        window.removeEventListener("hashchange", notify);
        listeners.clear();

        if (activeRouter === router) {
            activeRouter = null;
        }
    }

    window.addEventListener("hashchange", notify);

    const router = {
        routes,
        navigate,
        getCurrentRoute,
        subscribe,
        unsubscribe,
        destroy
    };

    activeRouter = router;

    return activeRouter;
}

export function navigate(path) {
    activeRouter?.navigate(path);
}

export function getCurrentRoute() {
    return activeRouter?.getCurrentRoute() ?? "/";
}

export function subscribe(listener) {
    return activeRouter?.subscribe(listener) ?? (() => {});
}

function getHashPath() {
    return normalizePath(window.location.hash.replace(/^#/, ""));
}

function normalizePath(path = "/") {
    const cleanPath = path.startsWith("#") ? path.slice(1) : path;

    if (!cleanPath || cleanPath === "/") {
        return "/";
    }

    return cleanPath.startsWith("/") ? cleanPath : `/${cleanPath}`;
}
