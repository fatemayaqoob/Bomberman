import { element } from "../../framework/element.js";
import { closeChat, openChat, sendLocalChatMessage } from "../ui-state.js";

export function Chat({ chat }) {
    let clickTimer = null;
    function handleFabClick() {
        clearTimeout(clickTimer);
        clickTimer = window.setTimeout(() => openChat(), 180);
    }
    function handleFabDoubleClick(event) {
        event.preventDefault();
        clearTimeout(clickTimer);
        closeChat();
    }
    function submit(event) {
        event.preventDefault();
        const input = event.currentTarget.elements.message;
        if (sendLocalChatMessage(input.value)) input.value = "";
    }
    return element("aside", { className: "chat-shell" },
        element("button", { className: "chat-fab", type: "button", onClick: handleFabClick, onDblClick: handleFabDoubleClick, "aria-label": "Open chat" },
            element("span", { "aria-hidden": true }, "CHAT"),
            chat.unread ? element("span", { className: "chat-badge" }, String(chat.unread)) : null
        ),
        chat.open ? element("section", { className: "chat-panel", "aria-label": "Local chat preview" },
            element("header", { className: "chat-panel__header" }, element("span", {}, "CHAT"), element("button", { type: "button", onClick: closeChat, "aria-label": "Close chat" }, "X")),
            element("ol", { className: "chat-messages", "aria-live": "polite" }, chat.messages.length
                ? chat.messages.map((message) => element("li", { className: "chat-message" }, `${message.author}: ${message.text}`))
                : element("li", { className: "chat-message chat-message--empty" }, "LOCAL CHAT PREVIEW")
            ),
            element("form", { className: "chat-form", onSubmit: submit },
                element("input", { name: "message", maxlength: 160, placeholder: "TYPE HERE", autocomplete: "off" }),
                element("button", { type: "submit" }, "SEND")
            )
        ) : null
    );
}
