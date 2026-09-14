# template-lib-ts

[![npm version](https://img.shields.io/npm/v/template-lib-ts.svg)](https://npmx.dev/package/template-lib-ts)
[![ci](https://github.com/posva/template-lib-ts/actions/workflows/ci.yml/badge.svg)](https://github.com/posva/template-lib-ts/actions/workflows/ci.yml)

A modern, AI-ready TypeScript library template.

- ⚡ Ultra-fast formatting, linting, and bundling with the [oxc](https://oxc.rs/) toolchain
- 🤖 [AGENTS.md](./AGENTS.md) support for AI-assisted development
- 🔁 [Claude Code hooks](https://code.claude.com/docs/en/hooks) for automated linting on stop
- 📦 Automatic release previews on every PR with [pkg.pr.new](https://pkg.pr.new)
- 🚀 One-command interactive release with changelog generation
- 🏷️ Better GitHub labels and repo settings out of the box

## Getting Started

1. Fork or clone this repository
2. Follow the **Migration Checklist** below to customize it for your library
3. Replace `src/useHello.ts` with your own code
4. Run `pnpm install` and start developing

## Migration Checklist

After forking, find & replace `template-lib-ts` with your package name, then go through these steps:

1. **Find & replace** `template-lib-ts` with your package name in all files
2. **Update `globalName`** in `tsdown.config.ts` (e.g. `PosvaTemplateLib` → `YourLibName`)
3. **Update `package.json`**: `description`, `keywords`, `homepage`, `bugs`, `repository`
4. **Update `LICENSE`** year and copyright holder
5. **Update `release.yml`** repo condition (`github.repository == '...'`)
6. **Set up npm trusted publishing** (see comments in `release.yml`)
7. **Set up [pkg.pr.new](https://pkg.pr.new)** (optional): install the [GitHub App](https://github.com/apps/pkg-pr-new/installations/select_target) on your repo, or remove `.github/workflows/pkg.pr.new.yml`
8. **Set up [Settings](https://github.com/apps/settings)** (optional): install the [GitHub App](https://github.com/apps/settings) on your repo and update `.github/settings.yml`, or remove it
9. **Set up Codecov** (optional): add `codecov/codecov-action` step to `ci.yml`
10. **Replace `src/`** with your library code
11. **Update `AGENTS.md`**: title, description, and Architecture section to match your project

## Scripts

| Command           | Description                |
| ----------------- | -------------------------- |
| `pnpm dev`        | Start Vitest UI            |
| `pnpm build`      | Build with tsdown          |
| `pnpm test`       | Build + test + typecheck   |
| `pnpm test:cov`   | Run tests with coverage    |
| `pnpm test:types` | Typecheck                  |
| `pnpm lint`       | Lint with oxlint           |
| `pnpm fmt`        | Format with oxfmt          |
| `pnpm release`    | Interactive release script |
| `pnpm size`       | Check bundle size          |

## License

[MIT](./LICENSE)
