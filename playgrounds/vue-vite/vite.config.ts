import { defineConfig } from 'vite'
import Vue from '@vitejs/plugin-vue'
import { McpDevtools } from 'medula/vite'

export default defineConfig({
  // Vite DevTools dock (@vitejs/devtools), coexists with medula
  devtools: true,
  plugins: [Vue(), McpDevtools()],
})
