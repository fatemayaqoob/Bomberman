import { element } from "../../framework/element.js";
import { MAX_PLAYERS } from "../ui-state.js";
import { Chat } from "../components/chat.js";

export function LobbyPage({ state }) {
    const { players, phase, secondsRemaining } = state.lobby;
    let statusLabel = "MATCH STARTS IN";

    if (players.length < 2) {
        statusLabel = "WAITING FOR PLAYERS...";
    } else if (phase === "countdown") {
        statusLabel = "GET READY!";
    }

    const statusText = phase === "waiting" && players.length >= 2
        ? `${statusLabel} ${secondsRemaining}s`
        : phase === "countdown"
        ? `${statusLabel} ${secondsRemaining}s`
        : statusLabel;

    return element(
        "section",
        { className: "screen screen--lobby" },
        element(
            "div",
            { className: "pixel-panel lobby-panel" },
            element("p", { className: "eyebrow" }, "WAITING LOBBY"),
            element("h1", {}, "BOMBERMAN"),
            element("h2", {}, `PLAYERS ${players.length} / ${MAX_PLAYERS}`),
            element(
                "p",
                { className: `lobby-status lobby-status--${phase}` },
                statusText
            ),
            element(
                "ol",
                { className: "player-slots" },
                Array.from({ length: MAX_PLAYERS }, (_, index) => {
                    const player = players[index];
                    const className = player
                        ? "player-slot player-slot--filled"
                        : "player-slot";
                    const label = player
                        ? `(PLAYER ${index + 1})  ${player.nickname}`
                        : "WAITING...";

                    return element("li", { className }, label);
                })
            ),
        ),
        element(Chat, { chat: state.chat })
    );
}
