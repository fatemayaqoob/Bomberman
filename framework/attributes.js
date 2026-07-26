// Shared DOM attribute handling for initial render and later patches.

const propertyNames = new Set([
    "autofocus",
    "checked",
    "disabled",
    "selected",
    "value"
]);

export function applyAttributes(domNode, attrs = {}) {
    for (const [name, value] of Object.entries(attrs)) {
        setAttribute(domNode, name, value);
    }
}

export function setAttribute(domNode, name, value, oldValue) {
    if (isEventAttribute(name, value) || isEventAttribute(name, oldValue)) {
        updateEvent(domNode, name, value, oldValue);
        return;
    }

    if (value === null || value === undefined || value === false) {
        removeAttribute(domNode, name);
        return;
    }

    if (name === "className") {
        domNode.setAttribute("class", value);
        return;
    }

    if (isPropertyName(name) && name in domNode) {
        domNode[name] = value;
    }

    if (value === true) {
        domNode.setAttribute(name, "");
        return;
    }

    domNode.setAttribute(name, value);
}

export function removeAttribute(domNode, name, oldValue) {
    if (isEventAttribute(name, oldValue)) {
        domNode.removeEventListener(getEventName(name), oldValue);
        return;
    }

    if (name === "className") {
        domNode.removeAttribute("class");
        return;
    }

    if (isPropertyName(name) && name in domNode) {
        domNode[name] = typeof domNode[name] === "boolean" ? false : "";
    }

    domNode.removeAttribute(name);
}

export function isEventAttribute(name, value) {
    return name.startsWith("on") && typeof value === "function";
}

function updateEvent(domNode, name, value, oldValue) {
    const eventName = getEventName(name);

    if (typeof oldValue === "function") {
        domNode.removeEventListener(eventName, oldValue);
    }

    if (typeof value === "function") {
        domNode.addEventListener(eventName, value);
    }
}

function getEventName(name) {
    return name.slice(2).toLowerCase();
}

function isPropertyName(name) {
    return propertyNames.has(name);
}
