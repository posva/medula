# Contributing to medula

Bug reports, documentation fixes, and pull requests are welcome. For a larger change, open an
issue first so we can discuss the approach.

## Local setup

Use Node.js LTS and the pnpm version specified in `package.json`.

```sh
git clone https://github.com/posva/medula.git
cd medula
pnpm install
pnpm build
```

The build produces the library and browser assets. Playgrounds use the local package, so build
before you start one and rebuild after changes to medula.

## Playgrounds

Start a playground and open its URL in your browser:

| Framework     | Command            | URL                   |
| ------------- | ------------------ | --------------------- |
| Vue and Pinia | `pnpm play:vue`    | http://localhost:5173 |
| React         | `pnpm play:react`  | http://localhost:5174 |
| Svelte 5      | `pnpm play:svelte` | http://localhost:5175 |
| Solid 1       | `pnpm play:solid`  | http://localhost:5176 |
| Solid 2 RC    | `pnpm play:solid2` | http://localhost:5177 |
| Next.js       | `pnpm play:next`   | http://localhost:3000 |
| Nuxt          | `pnpm play:nuxt`   | http://localhost:3001 |

For Nuxt types, run this after the initial build:

```sh
pnpm -C playgrounds/nuxt exec nuxt prepare
```

Nuxt preparation does not run during install because it needs the built medula module.

All six playgrounds share the same demo state and controls:

- A counter starts at `0`.
- The user starts as `Ada` in `Paris`, with the city nested at `user.address.city`. Toggle the
  name between Ada and Bob and watch the greeting update.
- Two todos start as “Open the page” (done) and “Try the MCP tools” (not done). Add todos or
  toggle their checkboxes and watch the remaining count update.
- Settings start with the light theme and a font size of `16`. Change the theme, set the font
  size from `12` to `24`, or hide and show the settings controls.

Each playground uses its framework's state APIs. Framework-specific examples remain available,
such as Pinia filters, React class state, and the Nuxt cart. This gives agents common tasks to
compare across frameworks while keeping useful adapter examples.

The repository MCP config uses `npx devframe connect` to find running dev servers. Keep the
playground tab visible while you use its tools. Playground configs disable client authentication
for local testing.

## Checks

Run the same checks as CI before you submit a pull request:

```sh
pnpm lint
pnpm test
```

`pnpm test` builds the package, runs tests with coverage, and checks types. For a smaller change,
you can run a specific test or check while you work:

```sh
pnpm exec vitest run src/client/path.spec.ts
pnpm test:types
pnpm exec oxfmt --check README.md
```

Use `pnpm lint:fix` to fix lint errors and `pnpm fmt` to format files. Unit tests live next to
source files as `src/**/*.spec.ts` and use Vitest with happy-dom. For a bug fix, add a regression
test when it fits and confirm that it fails before you implement the fix.

### Agent tests

These tests start a playground, open a browser, and ask an agent to change app state over MCP.
Build first. You need `agent-browser` and an installed, authenticated Claude Code or Codex CLI.

```sh
pnpm e2e:agent          # Vue with Claude Code
pnpm e2e:agent:codex    # Vue with Codex
pnpm e2e:agent:vue
pnpm e2e:agent:svelte
pnpm e2e:agent:solid
```

## Code conventions

Use TypeScript and ES modules. Vue code uses the Composition API. Keep comments short and explain
only constraints or behavior that the code cannot make clear.

The build uses `isolatedDeclarations`: exported values need explicit types, and default exports
must be identifiers. Keep framework hooks that are embedded as strings self-contained.

See [AGENTS.md](./AGENTS.md) for the architecture and adapter constraints.

## Issues and pull requests

For bug reports, include the framework and package versions, steps to reproduce, and the exact
error. A small reproduction helps us verify the problem.

Keep pull requests focused. Explain the problem, the change, and the checks you ran. Update user
documentation when behavior changes. Use Conventional Commits, such as `fix: restore component
state` or `docs: clarify setup`.
