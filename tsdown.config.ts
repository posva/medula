import { defineConfig } from 'tsdown'
import pkg from './package.json' with { type: 'json' }

const banner = `
/*!
 * ${pkg.name} v${pkg.version}
 * (c) ${new Date().getFullYear()} ${pkg.author.name}
 * @license MIT
 */
`.trim()

export default defineConfig({
  banner,
  clean: true,
  sourcemap: false,
  format: ['esm'],
  platform: 'node',
  target: 'esnext',
  tsconfig: 'tsconfig.build.json',
  entry: {
    index: 'src/index.ts',
    client: 'src/client/index.ts',
    vue: 'src/vue/index.ts',
    react: 'src/react/index.ts',
    svelte: 'src/svelte/index.ts',
    vite: 'src/vite/index.ts',
    next: 'src/next/index.ts',
    nuxt: 'src/nuxt/index.ts',
  },
  deps: {
    onlyBundle: [],
    neverBundle: [
      'vue',
      'pinia',
      'react',
      'svelte',
      'devframe',
      '@vitejs/devtools-kit',
      'zod',
      '@nuxt/kit',
      '@nuxt/schema',
      'vite',
      'next',
    ],
    // host framework type graphs (vite, @nuxt/*) cannot be bundled
    dts: { neverBundle: true },
  },
  dts: {
    enabled: true,
    // needs `isolatedDeclarations`: explicitly type every export
    generator: 'oxc',
  },
  // keeps package.json "exports" in sync with the entries above
  exports: true,
})
