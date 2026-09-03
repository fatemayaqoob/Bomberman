import { element } from "../../framework/element.js";
import { HAT_DETAILS, HAT_IDS } from "../game/cosmetics.js";
import { selectLocalHat } from "../ui-state.js";

export function HatSelector({ selectedHat, takenHats = new Set() }) {
    return element("fieldset", { className: "hat-selector" },
        element("legend", {}, "PICK A HAT"),
        element("div", { className: "hat-options" }, HAT_IDS.map((hat) => {
            const taken = hat !== selectedHat && takenHats.has(hat);
            const details = HAT_DETAILS[hat];
            return element("button", {
                type: "button",
                className: `hat-option${hat === selectedHat ? " hat-option--selected" : ""}${taken ? " hat-option--taken" : ""}`,
                disabled: taken,
                onClick: () => selectLocalHat(hat),
                "aria-pressed": hat === selectedHat,
                "aria-label": taken ? `${details.label} taken` : details.label
            },
            details.asset ? element("img", { src: details.asset, alt: "", draggable: false }) : element("span", { className: "hat-option__none" }, "X"),
            element("span", {}, taken ? "TAKEN" : details.label));
        }))
    );
}
