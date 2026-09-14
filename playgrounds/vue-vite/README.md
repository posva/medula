# Vue + Vite playground

Small todo app (Vue 3 + Pinia, Vite 8). It imports nothing from `medula`: the only
integration is `McpDevtools()` in `vite.config.ts`, next to `@vitejs/plugin-vue` and the Vite
DevTools dock (`devtools: true`).

The plugin injects a bootstrap script (Vue DevTools hook shim) and the page script. From there
agents get, with zero app code:

| Tool                                                                                                               | Reaches                                                                                                         |
| ------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------- |
| `mcp-devtools_list-states`, `get-state`, `set-state`, `patch-state`                                                | every Pinia store as `pinia:<id>`: here `pinia:todos` (`src/stores/todos.ts`)                                   |
| `mcp-devtools_vue_list-components`, `mcp-devtools_vue_get-component-state`, `mcp-devtools_vue_set-component-state` | props, setup bindings and data of any component: `title` and `settings` in `App.vue`, `draft` in `TodoList.vue` |

## Try it

```bash
pnpm build          # at the repo root, once
pnpm play:vue       # http://localhost:5173
```

Open the page, then from another terminal:

```bash
MCP=http://localhost:5173/__mcp-devtools/__mcp
rpc() { curl -s -X POST $MCP -H 'Origin: http://localhost:5173' -H 'Content-Type: application/json' -H 'Accept: application/json, text/event-stream' -d "$1"; echo; }

rpc '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}'
rpc '{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"mcp-devtools_list-states","arguments":{"arg0":{}}}}'
rpc '{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"mcp-devtools_patch-state","arguments":{"arg0":{"name":"pinia:todos","path":["items",1,"done"],"value":true}}}}'

# component internals: list ids, then edit the `title` ref and the `settings` object of App
rpc '{"jsonrpc":"2.0","id":4,"method":"tools/call","params":{"name":"mcp-devtools_vue_list-components","arguments":{"arg0":{}}}}'
rpc '{"jsonrpc":"2.0","id":5,"method":"tools/call","params":{"name":"mcp-devtools_vue_set-component-state","arguments":{"arg0":{"id":"0:root","section":"setupState","path":["title"],"value":"Hi from the agent"}}}}'
rpc '{"jsonrpc":"2.0","id":6,"method":"tools/call","params":{"name":"mcp-devtools_vue_set-component-state","arguments":{"arg0":{"id":"0:root","section":"setupState","path":["settings","theme"],"value":"dark"}}}}'
```

The page updates live. The config page is at <http://localhost:5173/__mcp-devtools/>. Tools exist
only while a page is open in a browser.
