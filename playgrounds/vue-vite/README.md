# Vue + Vite playground

Small todo app (Vue 3 + Pinia, Vite 8) that exposes state to agents with `mcp-devtools/vue`.

| Exposed state | How                                                   | Where                                |
| ------------- | ----------------------------------------------------- | ------------------------------------ |
| `todos`       | `pinia.use(piniaMcpDevtools)`: every store by `$id`   | `src/main.ts`, `src/stores/todos.ts` |
| `settings`    | `exposeReactive('settings', reactive({...}))`         | `src/settings.ts`                    |
| `todo-draft`  | `exposeRef('todo-draft', ref(''))` inside a component | `src/components/TodoList.vue`        |

`src/main.ts` also installs `app.use(mcpDevtoolsVue)`: agents get `mcp-devtools_vue_list-components`,
`mcp-devtools_vue_get-component-state` and `mcp-devtools_vue_set-component-state` to inspect and edit
any component's props, setup bindings and data, exposed or not (for example the `title` ref in
`App.vue`).

`vite.config.ts` uses `McpDevtools()` from `mcp-devtools/vite` next to `@vitejs/plugin-vue` and
turns on the Vite DevTools dock (`devtools: true`).

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
rpc '{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"mcp-devtools_patch-state","arguments":{"arg0":{"name":"settings","path":["theme"],"value":"dark"}}}}'
rpc '{"jsonrpc":"2.0","id":4,"method":"tools/call","params":{"name":"mcp-devtools_patch-state","arguments":{"arg0":{"name":"todos","path":["items",1,"done"],"value":true}}}}'

# component internals: list ids, then edit the non-exposed `title` ref of App
rpc '{"jsonrpc":"2.0","id":5,"method":"tools/call","params":{"name":"mcp-devtools_vue_list-components","arguments":{"arg0":{}}}}'
rpc '{"jsonrpc":"2.0","id":6,"method":"tools/call","params":{"name":"mcp-devtools_vue_set-component-state","arguments":{"arg0":{"id":"0:root","section":"setupState","path":["title"],"value":"Hi from the agent"}}}}'
```

The page updates live. The config page is at <http://localhost:5173/__mcp-devtools/>. Tools exist
only while a page is open in a browser.
