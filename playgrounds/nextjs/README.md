# playground-nextjs

Next 16 (App Router) playground. The app imports nothing from `mcp-devtools` besides the
host setup: `<McpDevtools />` in the root layout `<head>` (development only) inlines the
hook bootstrap and loads the page script, and the `mcp-devtools_react_*` tools edit component
state and props like React DevTools.

```bash
pnpm build          # at the repo root, once
pnpm play:next      # http://localhost:3000
```

- `next.config.ts`: `withMcpDevtools({...})`
- `app/%5F_mcp-devtools/[[...path]]/route.ts`: `createMcpDevtoolsHandler().fetch` as `GET`/`POST`/`DELETE`
- `app/layout.tsx`: `<head><McpDevtools /></head>`
- `app/profile.tsx`: `Profile` (`useState`), `Greeting` (props), `Clock` (class component)

MCP endpoint: `http://localhost:3000/__mcp-devtools/__mcp`. Config page: `http://localhost:3000/__mcp-devtools/`.
