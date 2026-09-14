import { defineConfig } from 'vite'
import { McpDevtools } from 'medula/vite'

export default defineConfig({
  plugins: [McpDevtools()],
})
