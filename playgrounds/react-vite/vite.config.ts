import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { McpDevtools } from 'mcp-devtools/vite'

export default defineConfig({
  plugins: [react(), McpDevtools({ react: true })],
  server: { port: 5174 },
})
