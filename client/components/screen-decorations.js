import { element } from "../../framework/element.js";

// Fixed side-only backdrop decorations. They never participate in page layout.
const DECORATIONS = [
    ["screen-decoration--flowers-left", "flowers"],
    ["screen-decoration--grass-left", "grass2"],
    ["screen-decoration--pot-right", "flowerpot"],
    ["screen-decoration--flowers-right", "flowers"],
    ["screen-decoration--grass-right", "grass3"]
];

export function ScreenDecorations() {
    return element("div", { className: "screen-decorations", "aria-hidden": true },
        DECORATIONS.map(([position, asset]) => element("span", { className: `screen-decoration ${position} screen-decoration--${asset}` }))
    );
}
