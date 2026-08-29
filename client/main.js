import { createApp } from "../framework/app.js";
import { element } from "../framework/element.js";
import { createRouter } from "../framework/router.js";
import { createStore } from "../framework/state.js";
import { NicknamePage } from "./pages/nickname.js";
import { LobbyPage } from "./pages/lobby.js";
import { GamePage } from "./pages/game.js";
import { bindUIStore, createInitialUIState } from "./ui-state.js";

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
    const Page = pages[route] ?? NicknamePage;

    return element(
        "main",
        { className: "bomberman-ui" },
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
