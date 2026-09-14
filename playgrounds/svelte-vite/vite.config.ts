import { defineConfig } from 'vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'
import { McpDevtools } from 'mcp-devtools/vite'

export default defineConfig({
  server: { port: 5175 },
  plugins: [svelte(), McpDevtools()],
})
