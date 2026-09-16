# medula

[![npm version](https://img.shields.io/npm/v/medula.svg)](https://npmx.dev/package/medula)
[![ci](https://github.com/posva/medula/actions/workflows/ci.yml/badge.svg)](https://github.com/posva/medula/actions/workflows/ci.yml)

> Change your web app's state from within it

medula lets your coding agent inspect and change the internal state of a running web app through
[MCP](https://modelcontextprotocol.io). Ask it to check a component, change a value, or navigate
to another route, and see the result in your browser.

It supports **Vue 3, React, Svelte 5, and Solid**, with integrations for **Vite, Nuxt, and
Next.js**. Vue apps also get support for Pinia and Vue Router. Add medula to your dev server, it infiltrates your app so you don't need to adapt anything in it.

| Framework        | What your agent can do                                                                                    |
| ---------------- | --------------------------------------------------------------------------------------------------------- |
| Vue 3            | Inspect the component tree, read and edit component state and Pinia stores, and navigate with Vue Router. |
| React            | Inspect components, read and edit hook state, and override props.                                         |
| Svelte 5         | Inspect components, read props and derived values, and edit `$state`.                                     |
| Solid 1.9 / 2 RC | Inspect components, read props and memos, and edit signals and stores.                                    |

medula runs during development and uses [devframe](https://devfra.me) to connect your app to
your agent.

## Setup

### Vue, React, Svelte, and Solid with Vite 8

Install medula and Vite DevTools in your app:

```sh
pnpm add -D medula @vitejs/devtools
```

Enable Vite DevTools and add `medula()` next to your existing framework plugin. For example,
with Vue:

```ts
// vite.config.ts
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { medula } from 'medula/vite'

export default defineConfig({
  devtools: true,
  plugins: [vue(), medula()],
})
```

For React, Svelte, or Solid, use the same config with your framework's import and `plugins` entry:

```ts
// React
import react from '@vitejs/plugin-react'
// plugins: [react(), medula()]

// Svelte 5
import { svelte } from '@sveltejs/vite-plugin-svelte'
// plugins: [svelte(), medula()]

// Solid 1
import solid from 'vite-plugin-solid'
// plugins: [solid(), medula()]

// Solid 2
import solid from '@solidjs/vite-plugin'
// plugins: [solid(), medula()]
```

medula detects the Solid version installed in the app. Solid 2 support is tested against
`2.0.0-rc.8`. It captures public setters from instrumented primitive imports; pending or failed
values appear as `null` until they can be read.

### Nuxt

Install medula:

```sh
pnpm add -D medula
```

Add the module to your Nuxt config. This requires Nuxt DevTools 4.

```ts
// nuxt.config.ts
export default defineNuxtConfig({
  devtools: { enabled: true },
  modules: ['medula/nuxt'],
})
```

### Next.js (App Router)

Install medula and the devframe packages:

```sh
pnpm add -D medula @devframes/agentic @devframes/next @devframes/hub-ui
```

Wrap your Next.js config with `withDevframe`:

```ts
// next.config.ts
import { withDevframe } from '@devframes/next/single'

export default withDevframe({})
```

Create the route below to serve the devtools. Use the folder name `%5F_devframes` exactly as
shown: Next.js treats folders that start with `_` as private.

```ts
// app/%5F_devframes/[[...path]]/route.ts
import { nextDevframeHub } from '@devframes/next/hub'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const hub = nextDevframeHub({
  devframes: [
    () =>
      import(/* webpackIgnore: true */ /* turbopackIgnore: true */ 'medula').then((m) =>
        m.medulaHubEntry(),
      ),
  ],
  auth: false, // for local development on a single-user machine
  register: true,
})

const handler = (request: Request) => hub.handler(request)

export { handler as DELETE, handler as GET, handler as POST }
```

Keep the import comments: they let medula load its assets correctly with Webpack and Turbopack.
`register: true` lets your agent discover the dev server.

Add `<Medula />` to the head of your root layout and the devtools script to the body:

```tsx
// app/layout.tsx
import type { ReactNode } from 'react'
import { Medula } from 'medula/next'

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <Medula />
      </head>
      <body>
        {children}
        {process.env.NODE_ENV === 'development' && (
          <script type="module" src="/__devframes/embedded.js" />
        )}
      </body>
    </html>
  )
}
```

## Connect your agent

Add this server to your agent's MCP configuration:

```json
{
  "mcpServers": {
    "devframe": {
      "command": "npx",
      "args": ["devframe", "connect"]
    }
  }
}
```

`devframe connect` finds all running dev servers. Its instance list identifies each app and its
port, and tool calls use that port to select the app.

Start your dev server and open the app in your browser. If DevTools asks for a connection code,
complete that step. Keep the app tab visible while your agent works: its tools are available
while the page is connected.

Try asking your agent:

- “Show me the components on this page and their current state.”
- “Set the cart quantity to 3 so I can check the total.”
- “Open the settings route.” (Vue Router)

Your agent can call `medula_help` for guidance and discover the tools for your app. Changes affect
the running page; they do not edit your source files.

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) for local setup, playgrounds, and checks.

## License

[MIT](./LICENSE)
