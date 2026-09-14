import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { McpDevtools } from 'medula/vite'

export default defineConfig({
  plugins: [react(), McpDevtools()],
  server: { port: 5174 },
})
