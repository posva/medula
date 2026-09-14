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
// app/%5F_mcp-devtools/[[...path]]/route.ts  (Next reserves `_` folders, so the name is URL-encoded)
import { createMcpDevtoolsHandler } from 'mcp-devtools/next'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const handler = createMcpDevtoolsHandler()
export const GET = handler.fetch
export const POST = handler.fetch
export const DELETE = handler.fetch
```

```tsx
// app/layout.tsx: connect pages in development only
{
  process.env.NODE_ENV === 'development' && (
    <script type="module" src="/__mcp-devtools/connect.js" />
  )
}
```

The MCP endpoint is `http://localhost:3000/__mcp-devtools/__mcp`; the RPC socket runs on a
side-car port advertised by `/__mcp-devtools/__connection.json`. The instance registers itself
for `devframe connect` on the first request under `/__mcp-devtools/`, so open a page once.

## Expose state

```ts
import { exposeState } from 'mcp-devtools/client'

let cart = { items: [] }
exposeState('cart', {
  description: 'Shopping cart',
  get: () => cart,
  set: (value) => (cart = value),
})
```

Every helper below returns a dispose function, accepts `{ description?: string }` and needs
JSON-friendly values (see `toJsonValue`).

### Vue / Pinia (`mcp-devtools/vue`)

```ts
import { exposeRef, exposeReactive, exposeStore, piniaMcpDevtools } from 'mcp-devtools/vue'

// every Pinia store, named by its $id
pinia.use(piniaMcpDevtools)

// a ref / shallowRef (also Nuxt useState)
const draft = ref('')
exposeRef('todo-draft', draft, { description: 'Text in the new todo input' })

// a reactive object: set replaces its content in place, references stay valid
const settings = reactive({ theme: 'light', fontSize: 16 })
exposeReactive('settings', settings)

// one store, custom name
exposeStore(useCartStore(), { name: 'cart', description: 'Shopping cart' })
```

Helpers dispose on their own when called inside an effect scope (component `setup`,
`effectScope()`, Pinia store). `exposeStore` reads `store.$state` and replaces it with one
`$patch` (keys missing from the new value are removed). In Nuxt, guard calls with
`if (import.meta.client)` or use a `.client.ts` plugin.

#### Component internals (Vue)

Like Vue DevTools, agents can inspect and edit the internal state of any component, exposed or
not. Install the plugin once per app:

```ts
import { mcpDevtoolsVue } from 'mcp-devtools/vue'

createApp(App).use(mcpDevtoolsVue)
// Nuxt: in a `.client.ts` plugin
export default defineNuxtPlugin(({ vueApp }) => vueApp.use(mcpDevtoolsVue))
```

Tools (dev only, while a page is open): `mcp-devtools_vue_list-components` (component tree with
stable ids, call it first), `mcp-devtools_vue_get-component-state` (`props`, `setupState`, `data`,
`readonly`; refs unwrapped, Pinia stores shown as `{ $piniaStore: id }`) and
`mcp-devtools_vue_set-component-state` (`{ id, section, path, value }`: refs get `.value`, objects
are edited in place, the UI re-renders).

### React (`mcp-devtools/react`)

```tsx
import { useExposedState, useExposeState, exposeStore } from 'mcp-devtools/react'

// useState that agents can read and write
const [todos, setTodos] = useExposedState('todos', [], { description: 'Todo list' })

// expose an existing state/setter pair (useState, useReducer, props...)
const [state, dispatch] = useReducer(reducer, initial)
useExposeState('form', state, (value) => dispatch({ type: 'set', value }))

// zustand-like store ({ getState, setState }), outside components
const dispose = exposeStore('cart', useCartStore, { description: 'Shopping cart' })
```

Hooks dispose on unmount and re-register when `name` changes.

#### Component internals (React)

With a small DevTools hook shim in place, agents also get `mcp-devtools_react_list-components`,
`mcp-devtools_react_get-component`, `mcp-devtools_react_set-hook-state` and
`mcp-devtools_react_set-props`: they read and edit `useState`/`useReducer` values, class state and
props of any mounted component, no `exposeState` needed. Development builds of React only. The hook
must exist before React loads:

```ts
// vite.config.ts
McpDevtools({ react: true }) // inlines the hook at the top of <head>
```

```tsx
// Next.js app/layout.tsx (development only)
import { reactDevtoolsHookScript } from 'mcp-devtools/next'

;<head>
  {process.env.NODE_ENV === 'development' && (
    <script dangerouslySetInnerHTML={{ __html: reactDevtoolsHookScript }} />
  )}
</head>
```

Other hosts: inline `REACT_DEVTOOLS_HOOK_SCRIPT` from `mcp-devtools/react` as a classic `<script>`
in `<head>`. `hooks[].index` is the hook position; `path: []` replaces the whole value.

### Svelte (`mcp-devtools/svelte`)

```ts
import { exposeStore, exposeRune } from 'mcp-devtools/svelte'
import { writable, derived } from 'svelte/store'

// writable store: agents can read and set it
const count = writable(0)
exposeStore('count', count, { description: 'Counter shown in the header' })

// readable store: read-only (set throws), or pass a custom setter
const total = derived(count, (c) => c * 2)
exposeStore('total', total, { set: (v) => count.set(v / 2) })

// runes ($state cannot be passed by reference): pass accessors
let name = $state('Eduardo')
exposeRune('name', { get: () => name, set: (v) => (name = v) })
```

#### Svelte internals: why explicit exposure

Svelte 5 cannot be inspected from outside: `$state` compiles to closure-local signals (the dev
`tag` label only feeds `$inspect.trace`), `component_context` is private to
`svelte/internal/client`, there are no `SvelteRegisterComponent`-style events, and `__svelte_meta`
on DOM nodes only carries source locations. The Svelte 4 approach of the official devtools
(`$capture_state()` / `$inject_state()`) has no Svelte 5 equivalent
([sveltejs/svelte-devtools#193](https://github.com/sveltejs/svelte-devtools/issues/193)). Expose
what agents need with `exposeRune` / `exposeStore`; see `playgrounds/svelte-vite`.

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
`pnpm e2e:agent:codex`) to change its state through the `devframe connect` MCP server.

## Development

See [AGENTS.md](./AGENTS.md).
