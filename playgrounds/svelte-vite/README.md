# Svelte + Vite playground

Small counter/todo app (Svelte 5 runes, Vite 8) with **no `medula` code in `src/`**. The
`medula()` Vite plugin instruments `svelte/internal/client` in dev, so agents list the
components and read/write their `$state` like a devtools would.

| What                                 | Where                    | Exposed as                                   |
| ------------------------------------ | ------------------------ | -------------------------------------------- |
| `count` (primitive), `todos`, `user` | `src/App.svelte`         | `state` of the `App` component               |
| `remaining`, `greeting`              | `src/App.svelte`         | `derived` of `App` (read-only)               |
| `label`, `done` props, `highlighted` | `src/Item.svelte`        | `props` / `state` of each `Item` (`{#each}`) |
| `settings`                           | `src/settings.svelte.ts` | `state` of the pseudo component `module`     |

## Try it

```bash
pnpm build          # at the repo root, once
pnpm play:svelte    # http://localhost:5175
```

Open the page, then from another terminal:

```bash
MCP=http://localhost:5175/__devtools/__mcp
rpc() { curl -s -X POST $MCP -H 'Origin: http://localhost:5175' -H 'Content-Type: application/json' -H 'Accept: application/json, text/event-stream' -d "$1"; echo; }

rpc '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}'
rpc '{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"medula_svelte_list-components","arguments":{"arg0":{}}}}'
rpc '{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"medula_svelte_get-component-state","arguments":{"arg0":{"id":"1"}}}}'
rpc '{"jsonrpc":"2.0","id":4,"method":"tools/call","params":{"name":"medula_svelte_set-component-state","arguments":{"arg0":{"id":"1","label":"count","path":[],"value":42}}}}'
rpc '{"jsonrpc":"2.0","id":5,"method":"tools/call","params":{"name":"medula_svelte_set-component-state","arguments":{"arg0":{"id":"1","label":"user","path":["address","city"],"value":"Lyon"}}}}'
rpc '{"jsonrpc":"2.0","id":6,"method":"tools/call","params":{"name":"medula_svelte_set-component-state","arguments":{"arg0":{"id":"module","label":"settings","path":["theme"],"value":"dark"}}}}'
```

The page updates live and `greeting` / `remaining` follow. The config page is at
<http://localhost:5175/__medula/>. Tools exist only while a page is open in a browser.

Dev builds only: `vite build` is untouched and `compilerOptions.dev = false` disables the
instrumentation (the compiler stops emitting the `tag`/`push` metadata the hook relies on).
