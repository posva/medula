# Solid 2 + Vite playground

The common counter, todos, profile, and settings demo runs on Solid `2.0.0-rc.8`.
App code imports primitives from `solid-js` and DOM APIs from `@solidjs/web`.
The `medula()` Vite plugin detects Solid 2 and exposes its components and state through MCP.

```sh
pnpm build
pnpm play:solid2 # http://localhost:5177
```

Use `medula_solid_list-components`, `medula_solid_get-component-state`, and
`medula_solid_set-component-state`. The same calls used by the [Solid 1 playground](../solid-vite/README.md)
work here. Signals and stores are writable. Memos and projections are read-only.
