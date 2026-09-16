import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { defineConfig } from 'vitest/config'
import Vue from '@vitejs/plugin-vue'

const require = createRequire(import.meta.url)
const solid2Root = dirname(require.resolve('solid-js-v2/package.json'))

export default defineConfig({
  resolve: {
    alias: { 'solid-js-v2': join(solid2Root, 'dist/solid.dev.js') },
  },
  plugins: [Vue()],
  test: {
    include: ['src/**/*.{test,spec}.ts'],
    environment: 'happy-dom',
    typecheck: {
      enabled: true,
    },
    coverage: {
      enabled: true,
      provider: 'v8',
      reporter: ['text', 'lcovonly', 'html'],
      include: ['src'],
      exclude: [
        '**/src/index.ts',
        '**/*.test-d.ts',
        'src/panel/**',
        'src/vite/**',
        'src/next/**',
        'src/nuxt/**',
      ],
    },
  },
})
