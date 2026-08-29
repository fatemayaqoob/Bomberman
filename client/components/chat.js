import { element } from "../../framework/element.js";
import { EVENTS, sendSocketEvent } from "../main.js";

export function Chat({ messages }) {
    function sendMessage(event) {
        event.preventDefault();

        const input = event.currentTarget.elements.message;
        const text = input.value.trim();

        if (!text) {
            return;
        }

        // TODO: Confirm chat payload fields and optimistic message handling.
        if (sendSocketEvent(EVENTS.CHAT_SEND, { text })) {
            input.value = "";
            input.focus();
        }
    }

    return element(
        "aside",
        { className: "chat" },
        element("h2", {}, "Chat"),
        element(
            "ol",
            { className: "chat__messages", "aria-live": "polite" },
            messages.map((message) => {
                return element(
                    "li",
                    { className: "chat__message", "data-message-id": message.id },
                    element("strong", {}, `${message.sender}: `),
                    message.text
                );
            })
        ),
        element(
            "form",
            { className: "chat__form", onSubmit: sendMessage },
            element("input", {
                name: "message",
                type: "text",
                placeholder: "Say something...",
                maxlength: 300,
                autocomplete: "off"
            }),
            // TODO: Add a send icon asset if the final UI uses an icon-only button.
            element("button", { type: "submit" }, "Send")
        )
    );
}
