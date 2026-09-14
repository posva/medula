# playground-react-vite

React 19 + Vite 8 playground for `mcp-devtools/react`.

```bash
pnpm build          # at the repo root, once
pnpm play:react     # http://localhost:5174
```

- `Counter`: `useExposedState('counter', 0)`
- `Todos`: `useExposeState('todos', todos, set)` on a `useReducer`
- `src/store.ts`: `exposeStore('settings', store)` on a tiny external store
- `Greeting`: plain `useState`, not exposed; edit it with `mcp-devtools_react_*` (`McpDevtools({ react: true })`)

MCP endpoint: `http://localhost:5174/__mcp-devtools/__mcp`. Config page: `http://localhost:5174/__mcp-devtools/`.
