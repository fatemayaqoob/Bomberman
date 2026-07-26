// createApp controls rendering so application code only describes UI.

import { render } from "./renderer.js";
import { diff, patch } from "./reconciler.js";

export function createApp({ root, component, store, router }) {
    const container = getContainer(root);
    let currentVNode = null;
    let currentDomNode = null;
    let isMounted = false;
    let unsubscribeStore = null;
    let unsubscribeRouter = null;

    function getContext() {
        return {
            store,
            router,
            state: store?.getState(),
            route: router?.getCurrentRoute()
        };
    }

    function buildTree() {
        return renderComponent(component, getContext());
    }

    function update() {
        const nextVNode = buildTree();
        const patches = diff(currentVNode, nextVNode);

        currentDomNode = patch(currentDomNode, patches);
        currentVNode = nextVNode;
    }

    function mount() {
        if (isMounted) {
            return currentDomNode;
        }

        currentVNode = buildTree();
        container.innerHTML = "";
        currentDomNode = render(currentVNode, container);

        unsubscribeStore = store?.subscribe(update) ?? null;
        unsubscribeRouter = router?.subscribe(update) ?? null;
        isMounted = true;

        return currentDomNode;
    }

    function destroy() {
        unsubscribeStore?.();
        unsubscribeRouter?.();

        if (currentDomNode) {
            currentDomNode.remove();
        }

        currentVNode = null;
        currentDomNode = null;
        unsubscribeStore = null;
        unsubscribeRouter = null;
        isMounted = false;
    }

    mount();

    return {
        mount,
        update,
        destroy
    };
}

function renderComponent(component, props = {}) {
    if (typeof component !== "function") {
        throw new Error("A component must be a function.");
    }

    return component(props);
}

function getContainer(root) {
    const container = typeof root === "string" ? document.querySelector(root) : root;

    if (!container) {
        throw new Error("createApp could not find a root container.");
    }

    return container;
}
