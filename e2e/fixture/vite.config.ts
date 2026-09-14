import { defineConfig } from 'vite'
import { McpDevtools } from 'mcp-devtools/vite'

export default defineConfig({
  plugins: [McpDevtools()],
})
