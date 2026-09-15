# playground-react-vite

React 19 + Vite 8 playground. The app imports nothing from `medula`: the Vite plugin
injects the hook bootstrap and the page script, and the `medula_react_*` tools edit
component state and props like React DevTools.

```bash
pnpm build          # at the repo root, once
pnpm play:react     # http://localhost:5174
```

The [common demo](../../CONTRIBUTING.md#playgrounds) lives in `App`: counter and nested user
(`useState`), todos (`useReducer`), and settings (`useState`). Each `Item` has props
and local hover state. “More state examples” contains `Greeting` (props) and `Clock` (class
component state + props).

MCP endpoint: `http://localhost:5174/__devtools/__mcp`. medula dock page: `http://localhost:5174/__medula/` (open it from the Vite DevTools dock).
