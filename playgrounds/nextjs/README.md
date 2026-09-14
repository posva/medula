# playground-nextjs

Next 16 (App Router) playground for `mcp-devtools/next` + `mcp-devtools/react`.

```bash
pnpm build          # at the repo root, once
pnpm play:next      # http://localhost:3000
```

- `next.config.ts`: `withMcpDevtools({ serverExternalPackages: [...] })`
- `app/%5F_mcp-devtools/[[...path]]/route.ts`: `createMcpDevtoolsHandler().fetch` as `GET`/`POST`/`DELETE`
- `app/layout.tsx`: loads `/__mcp-devtools/connect.js` in development only
- `app/profile.tsx`: client component with `useExposedState('profile', ...)`

MCP endpoint: `http://localhost:3000/__mcp-devtools/__mcp`. Config page: `http://localhost:3000/__mcp-devtools/`.
