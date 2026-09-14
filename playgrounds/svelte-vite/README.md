# Svelte + Vite playground

Small counter/todo app (Svelte 5 runes, Vite 8) that exposes state to agents with
`mcp-devtools/svelte`.

| Exposed state      | How                                                       | Where             |
| ------------------ | --------------------------------------------------------- | ----------------- |
| `count`, `todos`   | `exposeRune(name, { get, set })` for `$state` runes       | `src/App.svelte`  |
| `settings`         | `exposeStore('settings', writable({...}))`                | `src/settings.ts` |
| `settings-summary` | `exposeStore('settings-summary', derived(...))` read-only | `src/settings.ts` |

`vite.config.ts` uses `McpDevtools()` from `mcp-devtools/vite` next to
`@sveltejs/vite-plugin-svelte`.

## Try it

```bash
pnpm build          # at the repo root, once
pnpm play:svelte    # http://localhost:5175
```

Open the page, then from another terminal:

```bash
MCP=http://localhost:5175/__mcp-devtools/__mcp
rpc() { curl -s -X POST $MCP -H 'Origin: http://localhost:5175' -H 'Content-Type: application/json' -H 'Accept: application/json, text/event-stream' -d "$1"; echo; }

rpc '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}'
rpc '{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"mcp-devtools_list-states","arguments":{"arg0":{}}}}'
rpc '{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"mcp-devtools_set-state","arguments":{"arg0":{"name":"count","value":42}}}}'
rpc '{"jsonrpc":"2.0","id":4,"method":"tools/call","params":{"name":"mcp-devtools_patch-state","arguments":{"arg0":{"name":"settings","path":["theme"],"value":"dark"}}}}'
rpc '{"jsonrpc":"2.0","id":5,"method":"tools/call","params":{"name":"mcp-devtools_patch-state","arguments":{"arg0":{"name":"todos","path":[1,"done"],"value":true}}}}'
rpc '{"jsonrpc":"2.0","id":6,"method":"tools/call","params":{"name":"mcp-devtools_set-state","arguments":{"arg0":{"name":"settings-summary","value":"x"}}}}'
```

The page updates live; the last call fails with `"settings-summary" is read-only`. The config page
is at <http://localhost:5175/__mcp-devtools/>. Tools exist only while a page is open in a browser.

## No implicit component state

Unlike the Vue and React adapters, there is no `mcp-devtools_svelte_*` component inspector: Svelte 5
compiles `$state` to closure-local signals and exposes no runtime registry of component instances.
Expose what agents need with `exposeRune` / `exposeStore`. See the root README for details.
