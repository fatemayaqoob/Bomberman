# Mini Framework

An educational front-end mini-framework built with modern JavaScript modules.

The project demonstrates the core pieces behind a UI framework without introducing React, Vue, or a large runtime. Components are plain functions, UI is represented as Virtual DOM nodes, and updates flow through:

```text
state or route change -> component tree -> diff -> patch real DOM
```

The finished TodoMVC demo lives in `todoMVC/` and proves the framework through a branded task board webpage called Orchid.

## Features

- Virtual DOM node creation
- Function components
- DOM rendering
- Attribute, property, and event handling
- Store-based state updates
- Hash-based routing
- Virtual DOM diffing and DOM patching
- Orchid TodoMVC showcase page

## Project Structure

```text
mini-framework/
|-- index.html
|-- package.json
|-- README.md
|
|-- framework/
|   |-- app.js          # createApp lifecycle and update orchestration
|   |-- attributes.js   # shared DOM attribute/property/event handling
|   |-- element.js      # creates normalized virtual nodes
|   |-- reconciler.js   # diffs virtual trees and patches real DOM
|   |-- renderer.js     # turns virtual nodes into real DOM nodes
|   |-- router.js       # hash router
|   `-- state.js        # createStore
`-- todoMVC/
    |-- main.js         # starts the demo app
    |-- routes.js       # TodoMVC hash routes
    |-- store.js        # TodoMVC state and actions
    |-- style.css       # final Orchid UI styles
    |-- resources/
    `-- components/
        |-- App.js
        |-- Footer.js
        |-- TodoInput.js
        |-- TodoItem.js
        `-- TodoList.js
```

## How It Works

### Virtual nodes

`element(tag, attrs, ...children)` creates a virtual node:

```js
import { element } from "./framework/element.js";

const button = element(
    "button",
    {
        class: "primary",
        onClick: saveTodo
    },
    "Save"
);
```

The returned shape is:

```js
{
    tag: "button",
    attrs: {
        class: "primary",
        onClick: saveTodo
    },
    children: ["Save"]
}
```

Children are normalized so nested arrays are flattened and `null`, `undefined`, and booleans are ignored.

### Components

Components are functions that return virtual nodes. `createApp()` passes the current `state`, `route`, `store`, and `router` into the root component.

```js
export function Counter({ state, store }) {
    return element(
        "button",
        {
            onClick: () => store.setState({ count: state.count + 1 })
        },
        `Count: ${state.count}`
    );
}
```

### Rendering

`renderer.js` turns virtual nodes into DOM nodes. It supports:

- text nodes
- native DOM elements
- function components
- attributes such as `class` and `aria-*`
- DOM properties such as `value`, `checked`, `disabled`, and `autofocus`
- event props such as `onClick`, `onInput`, and `onKeyDown`

### Diffing and patching

`reconciler.js` compares the previous virtual tree with the next virtual tree and patches the existing DOM.

It handles:

- text updates
- element replacement
- attribute/property updates and removals
- event listener replacement and removal
- child creation and removal
- child updates by index

The current reconciler is intentionally small and unkeyed. It works well for the TodoMVC demo, but it does not implement keyed list reordering.

### State

`createStore(initialState)` returns:

- `getState()`
- `setState(partialStateOrUpdater)`
- `subscribe(listener)`
- `unsubscribe(listener)`

`subscribe()` returns an unsubscribe function. `setState()` shallow-merges partial state and notifies subscribers only when the shallow state object actually changes.

### Routing

`createRouter(routes)` creates a small hash router. The TodoMVC routes are:

- `#/`
- `#/active`
- `#/completed`

The router normalizes paths, notifies subscribers on hash changes, and exposes `destroy()` for listener cleanup.

### App lifecycle

`createApp({ root, component, store, router })` owns rendering:

1. Finds the root DOM container.
2. Builds the initial virtual tree.
3. Renders it into real DOM.
4. Subscribes to store and router changes.
5. Builds the next tree after each change.
6. Diffs and patches the existing DOM.
7. Cleans up subscriptions and DOM with `destroy()`.

## TodoMVC Demo

The Orchid TodoMVC app uses the framework APIs directly:

- `todoMVC/store.js` owns all todo state and actions.
- `todoMVC/routes.js` owns route definitions.
- `todoMVC/components/` contains only virtual-node UI components.
- `todoMVC/style.css` contains app-specific presentation.
- Framework files do not contain TodoMVC-specific logic.

Supported behavior:

- Add todos
- Toggle completion
- Delete todos
- Edit todos by double-clicking the title
- Filter All, Active, and Completed
- Complete or reopen all
- Clear completed
- Render a clean empty state
- Rerender after every store or route change

State persistence is not implemented; todos reset on page reload.

## Running

Because the project uses ES modules, run it through a local static server from the project root:

```bash
python -m http.server 5173
```

Open:

```text
http://localhost:5173
```

Do not open `index.html` directly from the filesystem; browser ES module imports need a local server.

## Verification

There is no automated test suite in this submission. You can syntax-check modules directly, for example:

```bash
Get-Content -Raw -LiteralPath framework/app.js | node --check --input-type=module
```

For functional verification, run the local server and exercise the Orchid TodoMVC demo in the browser:

- add a todo
- toggle completion
- delete a todo
- filter All, Active, and Completed
- complete or reopen all
- clear completed
- confirm the empty state appears
- confirm controls remain reachable when the page needs vertical scrolling

## Current Limitations

- The reconciler is unkeyed, so list updates are matched by index rather than stable keys.
- There is no batching or scheduler; each store or route update triggers an immediate diff/patch cycle.
- There is no component-local state or lifecycle hook system.
- There is no built-in persistence layer.
- There is no event delegation; event listeners are attached to the nodes that declare them.
- The router is hash-based only.

These limitations are intentional for a small educational framework, and they keep the code readable while still demonstrating Virtual DOM rendering, state, events, routing, and DOM reconciliation.
