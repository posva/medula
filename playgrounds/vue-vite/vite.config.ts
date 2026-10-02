import { defineConfig } from 'vite'
import Vue from '@vitejs/plugin-vue'
import { medula } from 'medula/vite'

export default defineConfig(({ command }) => ({
  // medula is a Vite DevTools dock. Single-user localhost: no one-time code,
  // so headless agents (e2e) connect too.
  devtools: command === 'serve' ? { clientAuth: false } : false,
  plugins: [Vue(), medula()],
}))
