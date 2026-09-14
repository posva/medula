# playground-nextjs

Next 16 (App Router) playground. The app imports nothing from `medula` besides the
host setup: `<Medula />` in the root layout `<head>` (development only) inlines the
hook bootstrap and loads the page script, and the `medula_react_*` tools edit component
state and props like React DevTools.

```bash
pnpm build          # at the repo root, once
pnpm play:next      # http://localhost:3000
```

- `next.config.ts`: `withMedula({...})`
- `app/%5F_medula/[[...path]]/route.ts`: `createMedulaHandler().fetch` as `GET`/`POST`/`DELETE`
- `app/layout.tsx`: `<head><Medula /></head>`
- `app/profile.tsx`: `Profile` (`useState`), `Greeting` (props), `Clock` (class component)

MCP endpoint: `http://localhost:3000/__medula/__mcp`. Config page: `http://localhost:3000/__medula/`.
