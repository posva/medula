# medula

Headless devtools for web apps: let a coding agent read and change the state of the page you have
open, through [MCP](https://modelcontextprotocol.io). Built on [devframe](https://devfra.me).

- **Zero app code.** Add the Vite plugin (or the Nuxt module / Next handler). An injected page
  script reaches framework internals the way the official devtools do: Vue component state,
  Pinia stores and the router, React hook state and props, Svelte 5 `$state`.
- **The agent is the UI.** No panel to learn: a plain config page at `/__medula/` shows how
  to connect Claude Code, Codex, Cursor or any MCP client.
- Works with Vite, Nuxt and Next.js dev servers.

## Setup

### Vite

```ts
// vite.config.ts
import { medula } from 'medula/vite'

export default defineConfig({
  plugins: [medula()],
})
```

### Nuxt

```ts
// nuxt.config.ts
export default defineNuxtConfig({
  modules: ['medula/nuxt'],
})
```

### Next.js (App Router)

```ts
// next.config.ts
import { withMedula } from 'medula/next'
export default withMedula({/* your config */})
```

```ts
// app/%5F_medula/[[...path]]/route.ts  (Next reserves `_` folders: URL-encoded name)
import { createMedulaHandler } from 'medula/next'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const handler = createMedulaHandler()
export const GET = handler.fetch
export const POST = handler.fetch
export const DELETE = handler.fetch
```

```tsx
// app/layout.tsx
import { Medula } from 'medula/next'

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <Medula /> {/* development only: hook bootstrap + page script */}
      </head>
      <body>{children}</body>
    </html>
  )
}
```

MCP endpoint: `http://localhost:3000/__medula/__mcp`. The RPC socket runs on a side-car port
advertised by `/__medula/__connection.json`; the instance registers itself for
`devframe connect` on the first request, so open a page once.

## What agents can do

Open the app in a browser with the dev server running. Tools appear on the MCP endpoint while the
page is open; arguments go under `arg0`. With several tabs of the app open, calls go to the tab you
focused last (background tabs disconnect).

### Vue, Pinia and Vue Router

The injected bootstrap installs a Vue DevTools hook shim before Vue loads, so every mounted app
announces itself, and the page script builds tools from what it finds:

| Tool                                                                             | What it reaches                                                                                                                                 |
| -------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `medula_list-states`, `get-state`, `set-state`, `patch-state`                    | every Pinia store as `pinia:<id>` (`$state`; set replaces it in one `$patch`), including stores created later                                   |
| `medula_vue_list-components`                                                     | component tree of every app: `{ id, name, file?, inactive?, children }`. Call it first                                                          |
| `medula_vue_get-component-state`                                                 | `{ props, setupState, data, readonly }` of one component; refs and computed unwrapped, functions skipped, stores shown as `{ $piniaStore: id }` |
| `medula_vue_set-component-state`                                                 | write at a path in `props`, `setupState` or `data`: refs get `.value`, objects are edited in place, the UI re-renders                           |
| `medula_router_get-route`, `medula_router_list-routes`, `medula_router_navigate` | when the app has Vue Router: current route, all route records, `router.push` by path or `{ name, params, query }`                               |

### React

The bootstrap installs a React DevTools hook before React loads, so development builds hand over
their internals and the page script registers these tools as soon as a renderer appears:

| Tool                           | What it does                                                              |
| ------------------------------ | ------------------------------------------------------------------------- |
| `medula_react_list-components` | Tree of mounted components: `id`, `name`, `statefulHooks`, `propKeys`     |
| `medula_react_get-component`   | Props, `useState`/`useReducer` values (`hooks[].index`) and class `state` |
| `medula_react_set-hook-state`  | Write a hook value (or a path inside it); class components update `state` |
| `medula_react_set-props`       | Override a prop at a path and re-render                                   |

Flow: `list-components`, then `get-component`, then `set-hook-state` / `set-props`. `path: []`
replaces the whole value. Production builds of React expose no internals: the tools answer with a
clear error.

### Svelte 5

With `medula()` in `vite.config.ts`, agents inspect and edit component state of any Svelte 5
dev build. The plugin serves an instrumented wrapper in place of `svelte/internal/client`, the
module every compiled component imports, and records components and their labelled
`$state`/`$derived` signals, like a devtools would.

| Tool                                | What it does                                                                                                                                                                                                                                            |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `medula_svelte_list-components`     | Tree of mounted components: `id`, `name`, `file`, `state` labels (writable), `derived` labels (read-only), prop names. Module-level `$state` (`.svelte.ts`) appears under the pseudo component `module`.                                                |
| `medula_svelte_get-component-state` | `{ props, state, derived }` snapshot of one component.                                                                                                                                                                                                  |
| `medula_svelte_set-component-state` | `{ id, label, path, value }`: writes a `$state` variable. Empty `path` replaces the value (an object `$state` the component never reassigns is replaced in place); nested paths mutate through the reactive proxy. `derived` and `props` are read-only. |

Dev builds only (`vite build` and `compilerOptions.dev = false` are untouched). Components
pre-bundled from `node_modules` are not instrumented. Props show what the parent passed, not
`$props()` fallbacks.

### Explicit exposure (escape hatch)

For state no devtools can reach, name it yourself from `medula/client`; it shows up in the
`*-state` tools:

```ts
import { exposeState } from 'medula/client'

exposeState('cart', {
  description: 'Shopping cart',
  get: () => cart,
  set: (value) => (cart = value),
})
```

Thin helpers exist for Vue (`exposeRef`, `exposeReactive`, `exposeStore`), React
(`useExposedState`, `useExposeState`, `exposeStore`) and Svelte (`exposeStore`, `exposeRune`);
none of them is needed for Vue, React or Svelte apps.
Every helper returns a dispose function and needs JSON-friendly values.

## Connect your agent

Open `http://localhost:<port>/__medula/` while the dev server runs. It shows the MCP URL and
ready-to-copy snippets, for example:

```sh
claude mcp add --transport http medula http://localhost:5173/__medula/__mcp
```

Tools: `medula_list-states`, `medula_get-state`, `medula_set-state`,
`medula_patch-state`. They exist while a page of your app is open in the browser.

Or let `devframe connect` discover every running dev server (this is what `.mcp.json` and
`.codex/config.toml` in this repo do):

```json
{ "mcpServers": { "devframe": { "command": "npx", "args": ["devframe", "connect"] } } }
```

## Playgrounds

`pnpm build`, then `pnpm play:vue` (Vite 8 + Vue + Pinia, with Vite DevTools), `pnpm play:react`,
`pnpm play:svelte`, `pnpm play:next` (Next 16) or `pnpm play:nuxt` (Nuxt 4 + Nuxt DevTools 4 alpha). Open the app,
then `/__medula/` on the same origin.

`pnpm e2e:agent` starts a fixture app, opens it in a browser and asks Claude Code (or Codex with
`pnpm e2e:agent:codex`) to change its state through the `devframe connect` MCP server;
`pnpm e2e:agent:vue` and `pnpm e2e:agent:svelte` do the same against the zero-config Vue and
Svelte playgrounds (component tools).

## Development

See [AGENTS.md](./AGENTS.md).
