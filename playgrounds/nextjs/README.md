# playground-nextjs

Next 16 (App Router) playground. The app imports nothing from `medula` besides the
host setup: `<Medula />` in the root layout `<head>` (development only) inlines the
hook bootstrap and loads the page script, and the `medula_react_*` tools edit component
state and props like React DevTools.

```bash
pnpm build          # at the repo root, once
pnpm play:next      # http://localhost:3000
```

- `next.config.ts`: `withDevframe({...})`
- `app/%5F_devframes/[[...path]]/route.ts`: the app-owned devframe hub with medula and Terminals panels
- `app/layout.tsx`: `<head><Medula /></head>`
- `app/playground.tsx`: the [common demo](../../CONTRIBUTING.md#playgrounds), with counter, nested user, todos, and settings
- `app/profile.tsx`: `Profile` (`useState`), `Greeting` (props), `Clock` (class component)

MCP endpoint: `http://localhost:3000/__devframes/__mcp`. Dock pages:

- medula: `http://localhost:3000/__devframes/medula/`
- Terminals: `http://localhost:3000/__devframes/devframes_plugin_terminals/`
