# playground-react-vite

React 19 + Vite 8 playground. The app imports nothing from `medula`: the Vite plugin
injects the hook bootstrap and the page script, and the `medula_react_*` tools edit
component state and props like React DevTools.

```bash
pnpm build          # at the repo root, once
pnpm play:react     # http://localhost:5174
```

Components: `Counter` (`useState`), `Todos` (`useReducer`), `Settings` (`useSyncExternalStore`),
`Greeting` (props), `Clock` (class component state + props).

MCP endpoint: `http://localhost:5174/__medula/__mcp`. Config page: `http://localhost:5174/__medula/`.
