import { element } from "../../framework/element.js";

const MAX_PLAYERS = 4;

export function LobbyPage({ state }) {
    const { players, phase, secondsRemaining } = state.lobby;
    const countdownLabel = phase === "ready" ? "Get ready!" : "Waiting for players";

    return element(
        "section",
        { className: "lobby-page" },
        // TODO: Add lobby background artwork and player avatar/ready-status icons here.
        element("h1", {}, "Lobby"),
        element(
            "p",
            { className: "player-counter" },
            `${players.length}/${MAX_PLAYERS} players joined`
        ),
        element(
            "p",
            { className: `lobby-countdown lobby-countdown--${phase}` },
            `${countdownLabel}: ${secondsRemaining}s`
        ),
        element(
            "ul",
            { className: "lobby-player-list" },
            players.length
                ? players.map((player, index) =>
                    element(
                        "li",
                        { className: "lobby-player", "data-player-id": player.id ?? index },
                        player.nickname ?? player.name ?? `Player ${index + 1}`
                    )
                )
                : element("li", { className: "lobby-player lobby-player--empty" }, "No players yet")
        ),
        element(
            "p",
            { className: "lobby-help" },
            "The server decides when the countdown begins and when the match starts."
        )
    );
}
