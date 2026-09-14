import { defineConfig } from 'vite'
import Vue from '@vitejs/plugin-vue'
import { McpDevtools } from 'mcp-devtools/vite'

export default defineConfig({
  // Vite DevTools dock (@vitejs/devtools), coexists with mcp-devtools
  devtools: true,
  plugins: [Vue(), McpDevtools()],
})
