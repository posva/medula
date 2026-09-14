# Nuxt playground

Nuxt 4 + `@pinia/nuxt` + the `mcp-devtools/nuxt` module, with `@nuxt/devtools` 4 alpha enabled.

| Exposed state | How                                                                   | Where                                                      |
| ------------- | --------------------------------------------------------------------- | ---------------------------------------------------------- |
| `cart`        | `$pinia.use(piniaMcpDevtools)` in a `.client.ts` plugin               | `app/plugins/mcp-devtools.client.ts`, `app/stores/cart.ts` |
| `visitor`     | `exposeRef('visitor', useState(...))` guarded by `import.meta.client` | `app/pages/index.vue`                                      |

The module adds the Vite plugin (client build only) and pushes `<script type="module"
src="/__mcp-devtools/connect.js">` in the head. Exposure is client only, SSR is untouched.

## Try it

```bash
pnpm build          # at the repo root, once
pnpm play:nuxt      # http://localhost:3001
```

Open the page, then:

```bash
MCP=http://localhost:3001/__mcp-devtools/__mcp
rpc() { curl -s -X POST $MCP -H 'Origin: http://localhost:3001' -H 'Content-Type: application/json' -H 'Accept: application/json, text/event-stream' -d "$1"; echo; }

rpc '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"mcp-devtools_list-states","arguments":{"arg0":{}}}}'
rpc '{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"mcp-devtools_patch-state","arguments":{"arg0":{"name":"visitor","path":["vip"],"value":true}}}}'
rpc '{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"mcp-devtools_patch-state","arguments":{"arg0":{"name":"cart","path":["coupon"],"value":"AGENT10"}}}}'
```
