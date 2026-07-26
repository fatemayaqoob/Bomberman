export function element(tag, attrs = {}, ...children) {
    const hasAttrs = isAttributes(attrs);

    return {
        tag,
        attrs: hasAttrs ? attrs : {},
        children: normalizeChildren(hasAttrs ? children : [attrs, ...children])
    };
}

function normalizeChildren(input, normalized = []) {
    for (const child of input) {
        if (Array.isArray(child)) {
            normalizeChildren(child, normalized);
            continue;
        }

        if (child === null || child === undefined || child === false || child === true) {
            continue;
        }

        normalized.push(typeof child === "bigint" ? String(child) : child);
    }

    return normalized;
}

function isAttributes(value) {
    return (
        value === null ||
        value === undefined ||
        (
            typeof value === "object" &&
            !Array.isArray(value) &&
            !isVNode(value)
        )
    );
}

function isVNode(value) {
    return value && typeof value === "object" && "tag" in value;
}
