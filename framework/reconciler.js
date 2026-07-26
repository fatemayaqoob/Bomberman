// Owns Virtual DOM reconciliation: diffing trees and applying DOM patches.

import { removeAttribute, setAttribute } from "./attributes.js";
import { createDomNode } from "./renderer.js";

export function diff(oldVNode, newVNode) {
    oldVNode = resolveComponent(oldVNode);
    newVNode = resolveComponent(newVNode);

    if (oldVNode === undefined || oldVNode === null) {
        return { type: "CREATE", node: newVNode };
    }

    if (newVNode === undefined || newVNode === null) {
        return { type: "REMOVE" };
    }

    if (isTextNode(oldVNode) || isTextNode(newVNode)) {
        return diffText(oldVNode, newVNode);
    }

    if (oldVNode.tag !== newVNode.tag) {
        return { type: "REPLACE", node: newVNode };
    }

    return {
        type: "UPDATE",
        attrs: diffAttributes(oldVNode.attrs, newVNode.attrs),
        children: diffChildren(oldVNode.children, newVNode.children)
    };
}

export function patch(domNode, patchInfo) {
    if (!patchInfo || patchInfo.type === "NONE") {
        return domNode;
    }

    if (patchInfo.type === "CREATE") {
        return createDomNode(patchInfo.node);
    }

    if (patchInfo.type === "REMOVE") {
        domNode?.remove();
        return null;
    }

    if (patchInfo.type === "REPLACE") {
        const newDomNode = createDomNode(patchInfo.node);
        domNode.replaceWith(newDomNode);
        return newDomNode;
    }

    if (patchInfo.type === "TEXT") {
        domNode.textContent = patchInfo.value;
        return domNode;
    }

    updateAttributes(domNode, patchInfo.attrs);
    updateChildren(domNode, patchInfo.children);

    return domNode;
}

function diffText(oldVNode, newVNode) {
    if (!isTextNode(oldVNode) || !isTextNode(newVNode)) {
        return { type: "REPLACE", node: newVNode };
    }

    if (String(oldVNode) !== String(newVNode)) {
        return { type: "TEXT", value: String(newVNode) };
    }

    return { type: "NONE" };
}

function diffAttributes(oldAttrs = {}, newAttrs = {}) {
    const patches = [];
    const names = new Set([
        ...Object.keys(oldAttrs),
        ...Object.keys(newAttrs)
    ]);

    for (const name of names) {
        const oldValue = oldAttrs[name];
        const newValue = newAttrs[name];

        if (newValue === undefined || newValue === null || newValue === false) {
            patches.push({ type: "REMOVE", name, oldValue });
            continue;
        }

        if (oldValue !== newValue) {
            patches.push({ type: "SET", name, value: newValue, oldValue });
        }
    }

    return patches;
}

function diffChildren(oldChildren = [], newChildren = []) {
    const patches = [];
    const length = Math.max(oldChildren.length, newChildren.length);

    for (let index = 0; index < length; index++) {
        patches.push({
            index,
            patch: diff(oldChildren[index], newChildren[index])
        });
    }

    return patches;
}

function updateAttributes(domNode, attrPatches = []) {
    for (const attrPatch of attrPatches) {
        if (attrPatch.type === "REMOVE") {
            removeAttribute(domNode, attrPatch.name, attrPatch.oldValue);
        }

        if (attrPatch.type === "SET") {
            setAttribute(domNode, attrPatch.name, attrPatch.value, attrPatch.oldValue);
        }
    }
}

function updateChildren(domNode, childPatches = []) {
    const updates = childPatches.filter(({ patch }) => !isCreateOrRemove(patch));
    const removals = childPatches.filter(({ patch }) => patch.type === "REMOVE").reverse();
    const creations = childPatches.filter(({ patch }) => patch.type === "CREATE");

    for (const childPatch of updates) {
        patch(domNode.childNodes[childPatch.index], childPatch.patch);
    }

    for (const childPatch of removals) {
        patch(domNode.childNodes[childPatch.index], childPatch.patch);
    }

    for (const childPatch of creations) {
        const newChild = createDomNode(childPatch.patch.node);
        domNode.insertBefore(newChild, domNode.childNodes[childPatch.index] ?? null);
    }
}

function resolveComponent(vNode) {
    if (vNode && typeof vNode === "object" && typeof vNode.tag === "function") {
        return resolveComponent(vNode.tag({
            ...vNode.attrs,
            children: vNode.children
        }));
    }

    return vNode;
}

function isCreateOrRemove(patchInfo) {
    return patchInfo.type === "CREATE" || patchInfo.type === "REMOVE";
}

function isTextNode(vNode) {
    return typeof vNode === "string" || typeof vNode === "number";
}
