# Nuxt playground

Nuxt 4 + `@pinia/nuxt`, with `@nuxt/devtools` 4 alpha enabled. The app imports nothing from
`medula`: the only integration is the module in `nuxt.config.ts`
(`modules: ['@pinia/nuxt', 'medula/nuxt']`).

The module adds the Vite plugin to the client build, puts the bootstrap script (Vue DevTools hook
shim) at the top of `<head>` and the page script before `</body>`. SSR is untouched. Agents get,
with zero app code:

| Tool                                                                               | Reaches                                                                                                                              |
| ---------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `medula_list-states`, `get-state`, `set-state`, `patch-state`                      | every Pinia store as `pinia:<id>`: `pinia:todos` and `pinia:cart` (`app/stores/`)                                                    |
| `medula_vue_list-components`, `..._get-component-state`, `..._set-component-state` | any component's props, setup bindings and data: `count`, `todos`, and shared `user`/`settings` (`useState`) in `app/pages/index.vue` |
| `medula_router_get-route`, `..._list-routes`, `..._navigate`                       | Vue Router: `/` (`index`) and `/about` (`about`)                                                                                     |

The [common demo](../../CONTRIBUTING.md#playgrounds) includes counter, nested user, todos, and
settings. “More state examples” contains the Pinia cart and a link to the second route.

## Try it

```bash
pnpm build          # at the repo root, once
pnpm play:nuxt      # http://localhost:3001
```

Open the page, then:

```bash
MCP=http://localhost:3001/__devtools/__mcp
rpc() { curl -s -X POST $MCP -H 'Origin: http://localhost:3001' -H 'Content-Type: application/json' -H 'Accept: application/json, text/event-stream' -d "$1"; echo; }

rpc '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"medula_list-states","arguments":{"arg0":{}}}}'
rpc '{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"medula_patch-state","arguments":{"arg0":{"name":"pinia:cart","path":["coupon"],"value":"AGENT10"}}}}'
rpc '{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"medula_vue_list-components","arguments":{"arg0":{}}}}'
# the page component is the deepest node ("index"); use its id
rpc '{"jsonrpc":"2.0","id":4,"method":"tools/call","params":{"name":"medula_vue_set-component-state","arguments":{"arg0":{"id":"0:5","section":"setupState","path":["user","address","city"],"value":"Lyon"}}}}'
rpc '{"jsonrpc":"2.0","id":5,"method":"tools/call","params":{"name":"medula_router_navigate","arguments":{"arg0":{"to":{"name":"about"}}}}}'
```
