import { element } from "../../framework/element.js";
import { connectToServer } from "../network.js";
import { HatSelector } from "../components/hat-selector.js";
import { getTakenHats } from "../ui-state.js";

export function NicknamePage({ state }) {
    function submit(event) {
        event.preventDefault();

        const nicknameInput = event.currentTarget.elements.nickname;
        if (!nicknameInput.value.trim()) {
            nicknameInput.focus();
            return;
        }
        connectToServer(nicknameInput.value.trim());
    }

    return element(
        "section",
        { className: "screen screen--nickname" },
        element(
            "div",
            { className: "pixel-panel nickname-panel" },
            element("h1", {}, "BOMBERMAN"),
            element(
                "p",
                { className: "screen-copy" },
                "Pick your nickname and join the waiting room"
            ),
            element(
                "form",
                { onSubmit: submit, className: "nickname-form" },
                element("label", { for: "nickname" }, ""),
                element("input", {
                    id: "nickname",
                    name: "nickname",
                    maxlength: 16,
                    autofocus: true,
                    placeholder: "Player name",
                    autocomplete: "nickname"
                }),
                element(HatSelector, { selectedHat: state.localPlayer.hat, takenHats: getTakenHats(state.lobby.players, state.localPlayer.id) }),
                element("button", { type: "submit" }, "ENTER LOBBY")
            ),
            state.connection.error ? element("p", { className: "connection-error", role: "alert" }, state.connection.error) : null,
            state.connection.status === "connecting" ? element("p", { className: "connection-status" }, "CONNECTING...") : null
        )
    );
}
