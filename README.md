# mcp-devtools

Headless devtools for web apps: let a coding agent read and change the state of the page you have
open, through [MCP](https://modelcontextprotocol.io). Built on [devframe](https://devfra.me).

- **Zero app code.** Add the Vite plugin (or the Nuxt module / Next handler). An injected page
  script reaches framework internals the way the official devtools do: Vue component state,
  Pinia stores and the router, React hook state and props.
- **The agent is the UI.** No panel to learn: a plain config page at `/__mcp-devtools/` shows how
  to connect Claude Code, Codex, Cursor or any MCP client.
- Works with Vite, Nuxt and Next.js dev servers.

## Setup

### Vite

```ts
// vite.config.ts
import { McpDevtools } from 'mcp-devtools/vite'

export default defineConfig({
  plugins: [McpDevtools()],
})
```

### Nuxt

```ts
// nuxt.config.ts
export default defineNuxtConfig({
  modules: ['mcp-devtools/nuxt'],
})
```

### Next.js (App Router)

```ts
// next.config.ts
import { withMcpDevtools } from 'mcp-devtools/next'
export default withMcpDevtools({/* your config */})
```

```ts
// app/%5F_mcp-devtools/[[...path]]/route.ts  (Next reserves `_` folders: URL-encoded name)
import { createMcpDevtoolsHandler } from 'mcp-devtools/next'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const handler = createMcpDevtoolsHandler()
export const GET = handler.fetch
export const POST = handler.fetch
export const DELETE = handler.fetch
```

```tsx
// app/layout.tsx
import { McpDevtools } from 'mcp-devtools/next'

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <McpDevtools /> {/* development only: hook bootstrap + page script */}
      </head>
      <body>{children}</body>
    </html>
  )
}
```

MCP endpoint: `http://localhost:3000/__mcp-devtools/__mcp`. The RPC socket runs on a side-car port
advertised by `/__mcp-devtools/__connection.json`; the instance registers itself for
`devframe connect` on the first request, so open a page once.

## What agents can do

Open the app in a browser with the dev server running. Tools appear on the MCP endpoint while the
page is open; arguments go under `arg0`.

### Vue, Pinia and Vue Router

The injected bootstrap installs a Vue DevTools hook shim before Vue loads, so every mounted app
announces itself, and the page script builds tools from what it finds:

| Tool                                                                                               | What it reaches                                                                                                                                 |
| -------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `mcp-devtools_list-states`, `get-state`, `set-state`, `patch-state`                                | every Pinia store as `pinia:<id>` (`$state`; set replaces it in one `$patch`), including stores created later                                   |
| `mcp-devtools_vue_list-components`                                                                 | component tree of every app: `{ id, name, file?, inactive?, children }`. Call it first                                                          |
| `mcp-devtools_vue_get-component-state`                                                             | `{ props, setupState, data, readonly }` of one component; refs and computed unwrapped, functions skipped, stores shown as `{ $piniaStore: id }` |
| `mcp-devtools_vue_set-component-state`                                                             | write at a path in `props`, `setupState` or `data`: refs get `.value`, objects are edited in place, the UI re-renders                           |
| `mcp-devtools_router_get-route`, `mcp-devtools_router_list-routes`, `mcp-devtools_router_navigate` | when the app has Vue Router: current route, all route records, `router.push` by path or `{ name, params, query }`                               |

### React

The bootstrap installs a React DevTools hook before React loads, so development builds hand over
their internals and the page script registers these tools as soon as a renderer appears:

| Tool                                 | What it does                                                              |
| ------------------------------------ | ------------------------------------------------------------------------- |
| `mcp-devtools_react_list-components` | Tree of mounted components: `id`, `name`, `statefulHooks`, `propKeys`     |
| `mcp-devtools_react_get-component`   | Props, `useState`/`useReducer` values (`hooks[].index`) and class `state` |
| `mcp-devtools_react_set-hook-state`  | Write a hook value (or a path inside it); class components update `state` |
| `mcp-devtools_react_set-props`       | Override a prop at a path and re-render                                   |

Flow: `list-components`, then `get-component`, then `set-hook-state` / `set-props`. `path: []`
replaces the whole value. Production builds of React expose no internals: the tools answer with a
clear error.

### Svelte

Svelte 5 cannot be inspected from outside: `$state` compiles to closure-local signals (the dev
`tag` label only feeds `$inspect.trace`), `component_context` is private to
`svelte/internal/client`, there are no `SvelteRegisterComponent`-style events, and `__svelte_meta`
on DOM nodes only carries source locations. The Svelte 4 approach of the official devtools
(`$capture_state()` / `$inject_state()`) has no Svelte 5 equivalent
([sveltejs/svelte-devtools#193](https://github.com/sveltejs/svelte-devtools/issues/193)). Expose
what agents need explicitly (below); see `playgrounds/svelte-vite`.

### Explicit exposure (escape hatch)

For state no devtools can reach, name it yourself from `mcp-devtools/client`; it shows up in the
`*-state` tools:

```ts
import { exposeState } from 'mcp-devtools/client'

exposeState('cart', {
  description: 'Shopping cart',
  get: () => cart,
  set: (value) => (cart = value),
})
```

Thin helpers exist for Vue (`exposeRef`, `exposeReactive`, `exposeStore`), React
(`useExposedState`, `useExposeState`, `exposeStore`) and Svelte (`exposeStore`, `exposeRune`).
Every helper returns a dispose function and needs JSON-friendly values.

## Connect your agent

Open `http://localhost:<port>/__mcp-devtools/` while the dev server runs. It shows the MCP URL and
ready-to-copy snippets, for example:

```sh
claude mcp add --transport http mcp-devtools http://localhost:5173/__mcp-devtools/__mcp
```

Tools: `mcp-devtools_list-states`, `mcp-devtools_get-state`, `mcp-devtools_set-state`,
`mcp-devtools_patch-state`. They exist while a page of your app is open in the browser.

Or let `devframe connect` discover every running dev server (this is what `.mcp.json` and
`.codex/config.toml` in this repo do):

```json
{ "mcpServers": { "devframe": { "command": "npx", "args": ["devframe", "connect"] } } }
```

## Playgrounds

`pnpm build`, then `pnpm play:vue` (Vite 8 + Vue + Pinia, with Vite DevTools), `pnpm play:react`,
`pnpm play:svelte`, `pnpm play:next` (Next 16) or `pnpm play:nuxt` (Nuxt 4 + Nuxt DevTools 4 alpha). Open the app,
then `/__mcp-devtools/` on the same origin.

`pnpm e2e:agent` starts a fixture app, opens it in a browser and asks Claude Code (or Codex with
`pnpm e2e:agent:codex`) to change its state through the `devframe connect` MCP server;
`pnpm e2e:agent:vue` does the same against the zero-config Vue playground (component + Pinia tools).

## Development

See [AGENTS.md](./AGENTS.md).
