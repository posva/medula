# Solid + Vite playground

Small counter/todo app (Solid 1.9, Vite 8) with **no `medula` code in `src/`**. The `medula()`
Vite plugin wraps `solid-js` in dev and hooks the `DEV` object of the development build, so agents
list the components and read/write their signals and stores like a devtools would. It also names
signals after their variable (`createSignal(0, { name: 'count' })`) so the labels are readable.

| What                                 | Where             | Exposed as                                        |
| ------------------------------------ | ----------------- | ------------------------------------------------- |
| `count`, `user` signals, `todos`     | `src/App.tsx`     | `state` of the `App` component                    |
| `remaining`, `greeting` memos        | `src/App.tsx`     | `derived` of `App` (read-only)                    |
| `label`, `done` props, `highlighted` | `src/Item.tsx`    | `props` / `state` of each `Item` (inside `<For>`) |
| `theme`, `settings`                  | `src/settings.ts` | `state` of the pseudo component `module`          |

The [common playground demo](../../CONTRIBUTING.md#playgrounds) includes a counter, todos,
a nested user profile, and theme/font controls. Toggle the user or hide and show settings from
the page; agents can also change the nested city and see the greeting update.

## Try it

```bash
pnpm build          # at the repo root, once
pnpm play:solid     # http://localhost:5176
```

Open the page, then from another terminal:

```bash
MCP=http://localhost:5176/__devtools/__mcp
rpc() { curl -s -X POST $MCP -H 'Origin: http://localhost:5176' -H 'Content-Type: application/json' -H 'Accept: application/json, text/event-stream' -d "$1"; echo; }

rpc '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}'
rpc '{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"medula_solid_list-components","arguments":{"arg0":{}}}}'
rpc '{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"medula_solid_get-component-state","arguments":{"arg0":{"id":"1"}}}}'
rpc '{"jsonrpc":"2.0","id":4,"method":"tools/call","params":{"name":"medula_solid_set-component-state","arguments":{"arg0":{"id":"1","label":"count","path":[],"value":42}}}}'
rpc '{"jsonrpc":"2.0","id":5,"method":"tools/call","params":{"name":"medula_solid_set-component-state","arguments":{"arg0":{"id":"1","label":"user","path":["address","city"],"value":"Lyon"}}}}'
rpc '{"jsonrpc":"2.0","id":6,"method":"tools/call","params":{"name":"medula_solid_set-component-state","arguments":{"arg0":{"id":"1","label":"todos","path":[0,"done"],"value":false}}}}'
rpc '{"jsonrpc":"2.0","id":7,"method":"tools/call","params":{"name":"medula_solid_set-component-state","arguments":{"arg0":{"id":"module","label":"theme","path":[],"value":"dark"}}}}'
```

The page updates live and `greeting` / `remaining` follow. The config page is at
<http://localhost:5176/__medula/>. Tools exist only while a page is open in a browser.

Dev builds only: `vite build` is untouched and `solid({ dev: false })` disables the instrumentation
(the production build of `solid-js` has no `DEV` object).
