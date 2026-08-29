import { element } from "../../framework/element.js";
import { submitNickname } from "../ui-state.js";

export function NicknamePage() {
    function submit(event) {
        event.preventDefault();

        const nicknameInput = event.currentTarget.elements.nickname;
        const submitted = submitNickname(nicknameInput.value);

        if (!submitted) {
            nicknameInput.focus();
        }
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
                element("button", { type: "submit" }, "ENTER LOBBY")
            )
        )
    );
}
