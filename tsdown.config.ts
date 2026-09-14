import { defineConfig } from 'tsdown'
import type { UserConfig } from 'tsdown'
import pkg from './package.json' with { type: 'json' }

const banner = `
/*!
 * ${pkg.name} v${pkg.version}
 * (c) ${new Date().getFullYear()} ${pkg.author.name}
 * @license MIT
 */
`.trim()

const commonOptions = {
  banner,
  // change to true if this helps debugging your library
  sourcemap: false,
  format: ['esm'],
  deps: {
    onlyBundle: [],
    neverBundle: ['vue'],
  },
  target: 'esnext',
  tsconfig: 'tsconfig.build.json',
  dts: {
    enabled: true,
    // NOTE: if you cannot use isolatedDeclarations, this makes writing types
    // bit harder but makes the generation way faster. Use tsc if you can't
    // explicitely type all exported values.
    // See https://github.com/microsoft/TypeScript/issues/58944#issuecomment-4213203205
    generator: 'oxc',
  },
  // sets package.json "exports" field to the generated files
  exports: true,
} satisfies UserConfig

export default defineConfig([
  {
    ...commonOptions,
    clean: true,
    entry: ['src/index.ts'],
    globalName: 'PosvaTemplateLib',
  },
])
