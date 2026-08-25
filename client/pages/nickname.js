import { element } from "../../framework/element.js";
import { EVENTS, sendSocketEvent } from "../main.js";

export function NicknamePage({ state, store }) {
    function submitNickname(event) {
        event.preventDefault();

        const nickname = event.currentTarget.elements.nickname.value.trim();

        if (!nickname) {
            store.setState({
                connection: {
                    ...store.getState().connection,
                    error: "Please enter a nickname."
                }
            });
            return;
        }

        store.setState({
            player: {
                ...store.getState().player,
                nickname
            },
            connection: {
                ...store.getState().connection,
                error: null
            }
        });

        // TODO: confirm if backend requires diff nickname registration 
        sendSocketEvent(EVENTS.NICKNAME_SUBMIT, { nickname });
    }

    return element(
        "section",
        { className: "nickname-page" },
        // TODO: Add the Bomberman title/logo artwork or a background illustration here.
        element("h1", {}, "Bomberman"),
        element("p", {}, "Choose a nickname to enter the lobby."),
        element(
            "form",
            { onSubmit: submitNickname },
            element("input", {
                name: "nickname",
                type: "text",
                placeholder: "Nickname",
                maxlength: 20,
                autofocus: true,
                autocomplete: "nickname"
            }),
            element(
                "button",
                { type: "submit", disabled: state.connection.status !== "connected" },
                state.connection.status === "connecting" ? "Connecting…" : "Join lobby"
            )
        ),
        state.connection.error
            ? element("p", { className: "form-error", role: "alert" }, state.connection.error)
            : null
    );
}
