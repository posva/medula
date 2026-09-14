import { resolve } from 'node:path'
import { defineConfig } from 'vite'

const panelDir = resolve(import.meta.dirname, 'src/panel')

// Plain HTML + CSS config page mounted at an arbitrary base by the devframe
// host, plus `connect.js`: the host-agnostic script that connects the app page
// to the devframe RPC so browser tools reach MCP.
export default defineConfig({
  root: panelDir,
  base: './',
  build: {
    outDir: resolve(import.meta.dirname, 'dist-client'),
    emptyOutDir: true,
    rollupOptions: {
      input: {
        index: resolve(panelDir, 'index.html'),
        connect: resolve(panelDir, 'connect.ts'),
      },
      output: {
        entryFileNames: (chunk) =>
          chunk.name === 'connect' ? 'connect.js' : 'assets/[name]-[hash].js',
      },
    },
  },
})
