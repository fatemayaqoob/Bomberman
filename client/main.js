import { createApp } from "../framework/app.js";
import { element } from "../framework/element.js";
import { createRouter } from "../framework/router.js";
import { createStore } from "../framework/state.js";
import { NicknamePage } from "./pages/nickname.js";
import { LobbyPage } from "./pages/lobby.js";
import { GamePage } from "./pages/game.js";
import { bindUIStore, createInitialUIState } from "./ui-state.js";
import { leaveCurrentGame } from "./ui-state.js";
import { leaveServer } from "./network.js";
import { ScreenDecorations } from "./components/screen-decorations.js";

export const store = createStore(createInitialUIState());
bindUIStore(store);

const router = createRouter({
    "/nickname": true,
    "/lobby": true,
    "/game": true
});

function App({ route, state, store: appStore, router: appRouter }) {
    const pages = {
        "/nickname": NicknamePage,
        "/lobby": LobbyPage,
        "/game": GamePage
    };
    const gameRouteIsValid = state.screen === "game" && state.game.matchSeed;
    const safeRoute = pages[route] && (route !== "/game" || gameRouteIsValid)
        ? route
        : "/nickname";
    if (route !== safeRoute) {
        queueMicrotask(() => appRouter.navigate(safeRoute));
    }
    const Page = pages[safeRoute];

    return element(
        "main",
        { className: "bomberman-ui" },
        element(ScreenDecorations),
        element(Page, {
            state,
            store: appStore,
            router: appRouter
        })
    );
}

if (!window.location.hash) {
    router.navigate("/nickname");
}

createApp({
    root: "#app",
    component: App,
    store,
    router
});

let restoringGameRoute = false;
window.addEventListener("hashchange", () => {
    const requestedRoute = window.location.hash.replace(/^#/, "") || "/nickname";
    const state = store.getState();
    if (restoringGameRoute || state.screen !== "game" || requestedRoute === "/game") {
        return;
    }

    if (!window.confirm("Are you sure you want to leave the game?")) {
        restoringGameRoute = true;
        window.location.hash = "/game";
        queueMicrotask(() => { restoringGameRoute = false; });
        return;
    }

    leaveServer();
    leaveCurrentGame();
});

window.addEventListener("beforeunload", (event) => {
    if (store.getState().screen !== "game") return;
    leaveServer();
    event.preventDefault();
    event.returnValue = "";
});
