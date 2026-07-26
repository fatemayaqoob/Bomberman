import { applyAttributes } from "./attributes.js";

export function createDomNode(vNode) {
    if (isTextNode(vNode)) {
        return document.createTextNode(String(vNode));
    }

    if (typeof vNode.tag === "function") {
        const componentVNode = vNode.tag({
            ...vNode.attrs,
            children: vNode.children
        });

        return createDomNode(componentVNode);
    }

    const domNode = document.createElement(vNode.tag);
    applyAttributes(domNode, vNode.attrs);
    renderChildren(domNode, vNode.children);

    return domNode;
}

function renderChildren(domNode, children = []) {
    for (const child of children) {
        domNode.appendChild(createDomNode(child));
    }
}

export function render(vNode, container) {
    const domNode = createDomNode(vNode);
    container.appendChild(domNode);

    return domNode;
}

function isTextNode(vNode) {
    return typeof vNode === "string" || typeof vNode === "number";
}
