# medula

Headless devtools built on [devframe](https://devfra.me). A coding agent reads and changes the
state of an open web page through MCP. No panel UI: only a plain HTML instructions page. medula
always runs as a **dock of a hub** (Vite DevTools, Nuxt DevTools 4, or its own hub in Next): the
hub owns the connection, the auth gate and the MCP route. It never runs a devframe of its own next
to another one (two devframes on one page fight over the shared `__DEVFRAME_CONNECTION__`).

## Commands

```bash
pnpm build                                   # tsdown (lib) + vite (config page, connect.js)
pnpm build:lib                               # lib only
pnpm test                                    # build + coverage + typecheck
pnpm exec vitest run src/client/path.spec.ts # one test file
pnpm lint / pnpm lint:fix                    # oxlint
pnpm test:types                              # tsc
pnpm play:vue | play:react | play:svelte | play:solid | play:next | play:nuxt   # playgrounds (run pnpm build first)
pnpm e2e:agent                               # Claude Code changes Vue playground state over MCP
pnpm e2e:agent:codex                         # same with Codex
pnpm e2e:agent:vue | e2e:agent:svelte | e2e:agent:solid   # zero-config playground scenarios
```

Playground ports: vue-vite 5173, react-vite 5174, svelte-vite 5175, solid-vite 5176, nextjs 3000, nuxt 3001.

## Important

Keep this file up to date when commands, structure or tooling change.

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
| `medula/nuxt`            | node    | Nuxt module: adds the Vite plugins (Nuxt DevTools 4 hosts Vite DevTools docks), inlines the bootstrap through `app.head`                                                                                    |

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

### Local devframe

`vendor/*.tgz` (`devframe`, `@devframes/hub`, `@devframes/hub-ui`, `@devframes/next`) are built
from `~/oss/devframe/.posva/worktrees/medula-vendor` (branch `medula-vendor` = PR
devframes/devframe#376 `eager-client-script`, in-page functions exposed through MCP and eager dock
client scripts, merged with `origin/main`; the PR alone is behind the released hub 0.9.19 and
`@vitejs/devtools-kit` 0.7.3, which import `toolInputToCommandArgs` from `devframe/internal`).
`pnpm-workspace.yaml` overrides point at them, so Vite DevTools, Nuxt DevTools and the Next hub
all run the PR code. To refresh:

```bash
MEDULA_VENDOR_DIR="$PWD/vendor"
cd ~/oss/devframe/.posva/worktrees/medula-vendor
git merge origin/main   # and re-merge eager-client-script when the PR moves
pnpm install && pnpm exec turbo run build --filter=devframe --filter=@devframes/hub --filter=@devframes/hub-ui --filter=@devframes/next
for p in devframe hub hub-ui next; do (cd packages/$p && pnpm pack --pack-destination "$MEDULA_VENDOR_DIR"); done
```

The devframe tarball also carries a local patch (most recently synced page wins in
`node/client-agent.ts`, uncommitted in the PR worktree, committed on `medula-vendor`); after
repacking under the same file name, update the tarball integrity in `pnpm-lock.yaml` (pnpm keeps
the cached copy otherwise). Replace with npm versions once the PR is released.

## Agent access

`.mcp.json` and `.codex/config.toml` register `npx devframe connect` (same shape as pinia-colada):
one stdio MCP server that discovers running dev servers through `~/.devframe/instances/` (Vite
DevTools does not publish itself there, so `medula/vite` registers its hub when the dev server
listens; Nuxt uses its own `listen` hook because Vite runs in middleware mode, and removes the
registration on Nuxt `close`; the Next hub passes `register: true`). Direct URL:
`<origin>/__devtools/__mcp` (Vite/Nuxt DevTools) or `<origin>/__devframes/__mcp` (Next).

## Verifying a change by hand

1. Start a playground, `agent-browser open http://localhost:<port>/` (use
   `AGENT_BROWSER_SESSION=<name>` when several servers run at once).
2. `curl -s -X POST <origin>/__devtools/__mcp -H 'Origin: <origin>' -H 'Content-Type: application/json' -H 'Accept: application/json, text/event-stream' -d '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}'`
   (`/__devframes/__mcp` for Next). The playgrounds set `devtools: { clientAuth: false }` (Nuxt:
   `vite.devtools`): with the hub's one-time code on, a headless page stays untrusted, no dock
   syncs and the page script never loads.
3. `tools/call` with `{"name":"medula_patch-state","arguments":{"arg0":{"name":"…","path":["…"],"value":…}}}`.

Routing between pages: the page script only stays connected while its tab is visible and
reconnects on `focus`, and the vendored devframe is patched so the MOST RECENTLY synced page wins
(`packages/devframe/src/node/client-agent.ts` in the worktree, uncommitted there: later manifests
overwrite earlier ones and a re-sync moves the session last). So tool calls go to the page the user
looked at last. Stray headless pages (`agent-browser close --all`) still compete until they lose
focus. When a connected tab goes away, the next call can hit
`[birpc] timeout on calling "devframe:agent:invoke-client-tool"` before calls succeed again. Use a
private port and `AGENT_BROWSER_SESSION` when verifying; `agent-browser tab N` does not switch the
`eval` target, use one session per page.

Adapter-specific tools use `registerAgentTools(namespace, functions)` (`src/client/tools.ts`):
`src/vue/internal.ts` (component tree walker + StateEditor-like setter, mirrors Vue DevTools) and
`src/react/internals.ts` + `src/react/hook.ts` (DevTools hook shim that captures renderer internals
such as `overrideHookState`; must run before React loads), `src/svelte/*` and `src/solid/*` (Vite
wrappers around the framework runtime, dev builds only; the hook functions are stringified into the
wrapper module so they must stay self-contained).

Solid notes: `afterCreateOwner` fires before `devComponent` sets `props`/`name`/`component`, so the
hook records only roots and the tools walk `owned` + `subRoots` (`createRoot` inside `<For>` /
`<Portal>`) at call time. solid-refresh 0.6 passes its `{ name }` as the memo's initial value, so
the HMR memo is unnamed: it is detected as the single memo child of a `[solid-refresh]*` component.
Module-level `createStore` registers a transient `{ value, name }`: only the raw object is kept
(`WeakRef`). Stores are written with `produce` on the raw object (the store proxy refuses direct
writes); signals with `DEV.writeSignal` and a structural copy (`setAtPath`).

## Constraints

- `isolatedDeclarations` is on (oxc dts): every export needs an explicit type, default exports
  must be identifiers.
- Auth and MCP belong to the hub. Vite/Nuxt DevTools: the app config decides (`clientAuth`). In
  Next the app owns the hub (`@devframes/next/hub`); medula only contributes `medulaHubEntry()`
  and the `<Medula />` head shims, so keep `medula/next` free of hub code.
- The dock page cannot compute the MCP URL alone: the hub meta served under the dock base carries
  `mcp.path` relative to the hub base. It reads the parent window's connection instead, so the URL
  only shows inside the dock.
- Tests: `src/**/*.spec.ts`, happy-dom, keep them simple. Playgrounds have no tests.
- Playgrounds live in `playgrounds/*` (pnpm workspace) and depend on `medula` via
  `link:../..`, so run `pnpm build` before `pnpm play:*`.
- The Nuxt playground must not run `nuxt prepare` during install: `medula/nuxt` needs
  the library build first. To generate Nuxt types, run
  `pnpm -C playgrounds/nuxt exec nuxt prepare` after `pnpm build`.
