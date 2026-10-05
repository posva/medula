# medula

Headless devtools built on [devframe](https://devfra.me). A coding agent reads and changes the
state of an open web page through MCP. Use it to verify bug fixes and explore edge cases in a
local dev server. State changes affect the running page, not source files.

medula runs as a **dock of a hub**: Vite DevTools, Nuxt DevTools, or an app-owned hub in Next.
The hub owns the connection, authentication, and MCP route. Do not create a separate devframe
on the same page: two devframes conflict over `__DEVFRAME_CONNECTION__`.
The dock contains only a plain HTML instructions page.

## Development

See [README.md](./README.md) for user setup and supported frameworks.
See [CONTRIBUTING.md](./CONTRIBUTING.md) for local setup, commands, playground ports, shared demo
state, and checks.

- Run `pnpm build` before starting a playground and rebuild after changes to medula.
- Run one test with `pnpm exec vitest run src/client/path.spec.ts`.
- Keep the playgrounds' initial values and common actions aligned. Use each framework's native
  state APIs and keep framework-specific examples. Shared styles are in `playgrounds/shared/style.css`.
- Keep this file current when architecture, constraints, or tooling change.

## Architecture

Zero app code: a host adapter inlines the hook bootstrap into the app page in dev and registers
medula as a hub dock; the hub client runtime imports the page script (the dock `clientScript`,
`eager: true`) into the page, and that script discovers frameworks like the official devtools do.

| Piece                    | Runs in | Purpose                                                                                                                                                                                                     |
| ------------------------ | ------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/page/bootstrap.ts`  | browser | `BOOTSTRAP_SCRIPT`: inline `<head>` script = Vue hook shim (`src/page/vue-hook.ts`) + React hook shim (`src/react/hook.ts`). Must run before the frameworks load.                                           |
| `src/panel/connect.ts`   | browser | The page script (`dist-client/connect.js`, dock `clientScript`): state channel + Vue/Pinia/Router + React + Svelte + Solid discovery. Never connects on its own.                                            |
| `src/panel/main.ts`      | browser | The dock page: static instructions; reads the hub connection of the parent window to show the MCP URL (`resolveMcpUrl` in `src/shared.ts`)                                                                  |
| `src/vue/internal.ts`    | browser | Component tree walker + StateEditor-like setter (mirrors Vue DevTools), Pinia/Router tools                                                                                                                  |
| `src/react/internals.ts` | browser | Fiber walker + `overrideHookState`/`overrideProps` through the hook shim (mirrors React DevTools)                                                                                                           |
| `src/svelte/*`           | browser | `hook.ts` wraps the `svelte/internal/client` dev entry points (inlined by `src/vite/svelte.ts`); `internals.ts` = `medula_svelte_*` tools                                                                   |
| `src/solid/*`            | browser | `hook.ts` installs the `DEV.hooks` of the `solid-js` dev build (inlined by `src/vite/solid.ts`, which also autonames signals); `internals.ts` walks roots -> owners -> `sourceMap` = `medula_solid_*` tools |
| `medula`                 | node    | `createMedula()` devframe definition (+ `help` tool and resource), `medulaDockClientScript()`                                                                                                               |
| `medula/vite`            | node    | `medula()` Vite plugins: `createPluginFromDevframe` (Vite DevTools dock at `/__medula/`) + bootstrap injection + Svelte/Solid instrumentation. Needs Vite DevTools.                                         |
| `medula/next`            | node    | `<Medula />` head component (hook shims only). The hub is the app's: `nextDevframeHub({ devframes: [medulaHubEntry()] })` as in devframe's `hub-next` example                                               |
| `medula/nuxt`            | node    | Nuxt module: adds the Vite plugins (Nuxt DevTools hosts Vite DevTools docks), inlines the bootstrap through `app.head`                                                                                      |

`src/panel/` also holds the dock page (plain HTML + CSS); `panel.vite.config.ts` builds it and
`connect.js` (keeps its default export: the hub runtime calls it) into `dist-client/`, which is
the definition's `clientAssets`. The hub serves them at the dock base.

### How a tool call reaches the page

1. The hub client runtime (Vite DevTools / Nuxt DevTools `embedded.js`, or `@devframes/hub-ui` in
   Next) imports `connect.js` from the medula dock entry.
2. The page script creates the in-page channel (`src/client/channel.ts`,
   `createPageScriptChannel`) and discovers framework state. Pinia stores are registered
   automatically. Channel functions carry `agent` metadata, so devframe registers them in
   its global browser-agent registry.
3. The hub's RPC connection mirrors the browser-agent registry to the node side
   (`devframe:agent:sync-client-tools`) and invokes tools back in the page
   (`devframe:agent:invoke-client-tool`). medula opens no connection itself.
4. The hub exposes them on its MCP route (`/__devtools/__mcp` under Vite/Nuxt DevTools,
   `/__devframes/__mcp` in Next). Pinia stores use `medula_list-states`, `medula_get-state`,
   `medula_set-state` and `medula_patch-state`; framework tools appear next to them and the tools
   of the other docks. Tool args are a single object under `arg0`.

Tools exist only while a page is connected. `medula_help` (node side) explains that to the
agent.

## Agent access

`.mcp.json` and `.codex/config.toml` use `npx devframe connect`. The connector discovers dev
servers through `~/.devframe/instances/` and selects an app by its port.
Vite and Nuxt hubs register automatically; the Next hub needs `register: true`.
Registration starts when the first hub request supplies its origin. The record is removed on close.

Call `devframe_connect_list-instances` first, then pass the instance port to
`devframe_connect_call-tool`. Tabs in one app share one server MCP surface; medula does not select
a tab. Keep the app tab visible and use one browser session per app for verification.

## Verifying a change by hand

1. Start a playground, `agent-browser open http://localhost:<port>/` (use
   `AGENT_BROWSER_SESSION=<name>` when several servers run at once).
2. `curl -s -X POST <origin>/__devtools/__mcp -H 'Origin: <origin>' -H 'Content-Type: application/json' -H 'Accept: application/json, text/event-stream' -d '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}'`
   (`/__devframes/__mcp` for Next). The playgrounds set `devtools: { clientAuth: false }` (Nuxt:
   `vite.devtools`): with the hub's one-time code on, a headless page stays untrusted, no dock
   syncs and the page script never loads.
3. `tools/call` with `{"name":"medula_patch-state","arguments":{"arg0":{"name":"…","path":["…"],"value":…}}}`.

## Adapter notes

Adapter tools use `registerAgentTools(namespace, functions)` in `src/client/tools.ts`.
Svelte and Solid hooks are embedded as strings in Vite wrappers and must stay self-contained.

React `list-components` waits for document load, the first commit from each injected renderer,
and hydration of all known roots and Suspense boundaries. It then requires 250 ms without root
or renderer changes. After 5 seconds it throws a readiness error instead of returning a partial
tree. The result remains an array; roots mounted after this discovery window appear on the next
call. A renderer that never commits also produces a readiness error. The hook records first
commits so a renderer whose roots were all unmounted does not block later calls.

Solid notes: `afterCreateOwner` fires before `devComponent` sets `props`/`name`/`component`, so the
hook records only roots and the tools walk `owned` + `subRoots` (`createRoot` inside `<For>` /
`<Portal>`) at call time. solid-refresh passes its `{ name }` as the memo's initial value, so
the HMR memo is unnamed: it is detected as the single memo child of a `[solid-refresh]*` component.
Module-level `createStore` registers a transient `{ value, name }`: only the raw object is kept
(`WeakRef`). Stores are written with `produce` on the raw object (the store proxy refuses direct
writes); signals with `DEV.writeSignal` and a structural copy (`setAtPath`).

The Vite plugin detects the installed Solid major. For the newer API, `hook2.ts` captures public
setters from `solid-js` / `@solidjs/signals` primitive wrappers. The adapter uses
`DEV.onOwner`, `getChildren` and `getParent`, normalizes owners for the shared tools, and flushes
writes before returning. Projections and memos are read-only; pending/failed reads return null.
The `solid-vite` and `solid2-vite` playgrounds exercise the two adapters. The root `solid-js-v2`
npm alias supplies runtime tests, with a Vitest alias selecting its browser development build.

## Constraints

- Use public devframe APIs. Registration belongs to the host hub through `register`, not to
  medula through `devframe/internal`.
- `isolatedDeclarations` is on (oxc dts): every export needs an explicit type, default exports
  must be identifiers.
- Auth and MCP belong to the hub. Vite/Nuxt DevTools: the app config decides (`clientAuth`). In
  Next the app owns the hub (`@devframes/next/hub`); medula only contributes `medulaHubEntry()`
  and the `<Medula />` head shims, so keep `medula/next` free of hub code.
- The dock page cannot compute the MCP URL alone: the hub meta served under the dock base carries
  `mcp.path` relative to the hub base. It reads the parent window's connection instead, so the URL
  only shows inside the dock.
- Tests: `src/**/*.spec.ts`, happy-dom, keep them simple. Add tests only for behavior that can
  regress. Do not test one-time dependency migration details. Playgrounds have no tests.
- Playgrounds live in `playgrounds/*` (pnpm workspace) and depend on `medula` via `link:../..`.
- The Nuxt playground must not run `nuxt prepare` during install: `medula/nuxt` needs
  the library build first. To generate Nuxt types, run
  `pnpm -C playgrounds/nuxt exec nuxt prepare` after `pnpm build`.
