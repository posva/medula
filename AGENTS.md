# medula

Headless devtools built on [devframe](https://devfra.me). A coding agent reads and changes the
state of an open web page through MCP. No panel UI: only a plain HTML config page.

## Commands

```bash
pnpm build                                   # tsdown (lib) + vite (config page, connect.js)
pnpm build:lib                               # lib only
pnpm test                                    # build + coverage + typecheck
pnpm exec vitest run src/client/path.spec.ts # one test file
pnpm lint / pnpm lint:fix                    # oxlint
pnpm test:types                              # tsc
pnpm play:vue | play:react | play:svelte | play:next | play:nuxt   # playgrounds (run pnpm build first)
pnpm e2e:agent                               # Claude Code changes the fixture state over MCP
pnpm e2e:agent:codex                         # same with Codex
pnpm e2e:agent:vue | e2e:agent:svelte        # zero-config playground scenarios
```

Playground ports: vue-vite 5173, react-vite 5174, svelte-vite 5175, e2e fixture 5199, nextjs 3000,
nuxt 3001.

## Important

Keep this file up to date when commands, structure or tooling change.

## Architecture

Zero app code: a host adapter injects two scripts into the app page in dev, and the page script
discovers frameworks like the official devtools do.

| Piece                    | Runs in | Purpose                                                                                                                                                           |
| ------------------------ | ------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/page/bootstrap.ts`  | browser | `BOOTSTRAP_SCRIPT`: inline `<head>` script = Vue hook shim (`src/page/vue-hook.ts`) + React hook shim (`src/react/hook.ts`). Must run before the frameworks load. |
| `src/panel/connect.ts`   | browser | The page script (`dist-client/connect.js`): state channel + Vue/Pinia/Router discovery + React discovery + `connectDevframe()`                                    |
| `src/vue/internal.ts`    | browser | Component tree walker + StateEditor-like setter (mirrors Vue DevTools), Pinia/Router tools                                                                        |
| `src/react/internals.ts` | browser | Fiber walker + `overrideHookState`/`overrideProps` through the hook shim (mirrors React DevTools)                                                                 |
| `medula`                 | node    | `createMcpDevtools()` devframe definition (+ `help` tool and resource)                                                                                            |
| `medula/vite`            | node    | `McpDevtools()` Vite plugin: bridge + config page + injects bootstrap and `connect.js`                                                                            |
| `medula/next`            | node    | `createMcpDevtoolsHandler()` route handler, `withMcpDevtools()`, `<McpDevtools />` head component                                                                 |
| `medula/nuxt`            | node    | Nuxt module: adds the Vite plugin, injects bootstrap and `connect.js` through `app.head`                                                                          |
| `medula/client`          | browser | Manual escape hatch: `exposeState(name, { get, set })` for state no devtools can reach                                                                            |
| `medula/vue              | react   | svelte`                                                                                                                                                           | browser | Manual helpers over `exposeState`; not needed for Vue/React apps |

`src/panel/` also holds the config page (plain HTML + CSS); `panel.vite.config.ts` builds it and
`connect.js` into `dist-client/`, which is the definition's `clientAssets`.

### How a tool call reaches the page

1. App code calls `exposeState()` (`src/client/registry.ts`). The registry lives on
   `globalThis[Symbol.for('mcp-devtools:registry')]` so several bundles share it.
2. The first call creates the in-page channel (`src/client/channel.ts`,
   `createPageScriptChannel`). Its functions carry `agent` metadata, so devframe registers them in
   its global browser-agent registry.
3. `connect.js` (served at `<base>connect.js`) runs `connectDevframe()` in the page. Devframe mirrors
   the browser-agent registry to the node side over RPC (`devframe:agent:sync-client-tools`) and
   invokes tools back in the page (`devframe:agent:invoke-client-tool`).
4. The node side exposes them on the MCP route `<base>__mcp` as `mcp-devtools_list-states`,
   `mcp-devtools_get-state`, `mcp-devtools_set-state`, `mcp-devtools_patch-state`. Tool args are a
   single object under `arg0`.

Tools exist only while a page is connected. `mcp-devtools_help` (node side) explains that to the
agent.

### Local devframe

`vendor/*.tgz` are built from `~/oss/devframe/.posva/worktrees/eager-client-script` (branch
`eager-client-script`, PR devframes/devframe#376: in-page functions exposed through MCP). Root
`package.json` and `pnpm-workspace.yaml` overrides point at them. To refresh:

```bash
cd ~/oss/devframe/.posva/worktrees/eager-client-script
pnpm exec turbo run build --filter=devframe --filter=@devframes/vite --filter=@devframes/next
for p in devframe vite next; do (cd packages/$p && pnpm pack --pack-destination ~/oss/mcp-devtools/vendor); done
```

The devframe tarball also carries a local patch (most recently synced page wins in
`node/client-agent.ts`); after repacking, update the tarball integrity in `pnpm-lock.yaml`
(pnpm keeps the cached copy otherwise). Replace with npm versions once the PR is released.

## Agent access

`.mcp.json` and `.codex/config.toml` register `npx devframe connect` (same shape as pinia-colada):
one stdio MCP server that discovers running dev servers through `~/.devframe/instances/` (the
Vite plugin registers with `register: true`). Direct URL: `<origin>/__medula/__mcp`.

## Verifying a change by hand

1. Start a playground, `agent-browser open http://localhost:<port>/` (use
   `AGENT_BROWSER_SESSION=<name>` when several servers run at once).
2. `curl -s -X POST <origin>/__medula/__mcp -H 'Origin: <origin>' -H 'Content-Type: application/json' -H 'Accept: application/json, text/event-stream' -d '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}'`
3. `tools/call` with `{"name":"mcp-devtools_patch-state","arguments":{"arg0":{"name":"…","path":["…"],"value":…}}}`.

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
such as `overrideHookState`; must run before React loads).

## Constraints

- `isolatedDeclarations` is on (oxc dts): every export needs an explicit type, default exports
  must be identifiers.
- Auth is off by default in the host adapters (single-user localhost). MCP route is forced on
  (`mcp: true`) because client tools arrive after startup.
- Tests: `src/**/*.spec.ts`, happy-dom, keep them simple. Playgrounds have no tests.
- Playgrounds live in `playgrounds/*` (pnpm workspace) and depend on `medula` via
  `link:../..`, so run `pnpm build` before `pnpm play:*`.
- The Nuxt playground must not run `nuxt prepare` during install: `medula/nuxt` needs
  the library build first. To generate Nuxt types, run
  `pnpm -C playgrounds/nuxt exec nuxt prepare` after `pnpm build`.
