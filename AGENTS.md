# Vue Library Template

Minimal Vue 3 composable library template using the oxc ecosystem.

## Commands

```bash
pnpm build                                 # build with tsdown
pnpm test                                  # full suite: build + coverage + typecheck
pnpm test:cov                              # vitest with coverage
pnpm exec vitest run src/useHello.spec.ts  # single test file
pnpm lint                                  # oxlint
pnpm lint:fix                              # oxlint with auto-fix
pnpm test:types                            # tsc type checking
```

## Important

Always keep this file up to date when project commands, structure, or tooling change.

## Architecture

Single-package Vue 3 composable library. `src/index.ts` re-exports composables from `src/use*.ts`. Tests co-located as `*.spec.ts`; type tests as `*.test-d.ts`.

Built with tsdown (`tsdown.config.ts`), outputs ESM to `dist/`. oxc toolchain: oxlint for linting, oxfmt for formatting.
