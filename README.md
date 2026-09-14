# mcp-devtools

Headless devtools for web apps: let a coding agent read and change the state of the page you have
open, through [MCP](https://modelcontextprotocol.io). Built on [devframe](https://devfra.me).

- Expose any state with `exposeState()`; helpers for Vue, Pinia, React and Svelte.
- Works with Vite, Nuxt and Next.js dev servers.
- No UI to learn: a plain config page at `/__mcp-devtools/` shows how to connect your agent.

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

### Next.js

```ts
// app/__mcp-devtools/[[...path]]/route.ts
import { createMcpDevtoolsHandler } from 'mcp-devtools/next'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
const handler = createMcpDevtoolsHandler()
export const GET = handler.fetch
export const POST = handler.fetch
export const DELETE = handler.fetch
```

Then add `<script type="module" src="/__mcp-devtools/connect.js" />` to your root layout in
development.

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

See `mcp-devtools/vue`, `mcp-devtools/react` and `mcp-devtools/svelte` for framework helpers.

## Connect your agent

Open `http://localhost:<port>/__mcp-devtools/` while the dev server runs. It shows the MCP URL and
ready-to-copy snippets, for example:

```sh
claude mcp add --transport http mcp-devtools http://localhost:5173/__mcp-devtools/__mcp
```

Tools: `mcp-devtools_list-states`, `mcp-devtools_get-state`, `mcp-devtools_set-state`,
`mcp-devtools_patch-state`. They exist while a page of your app is open in the browser.

## Development

See [AGENTS.md](./AGENTS.md).
