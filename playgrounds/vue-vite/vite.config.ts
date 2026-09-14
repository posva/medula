import { defineConfig } from 'vite'
import Vue from '@vitejs/plugin-vue'
import { medula } from 'medula/vite'

export default defineConfig({
  // medula is a Vite DevTools dock. Single-user localhost: no one-time code,
  // so headless agents (e2e) connect too.
  devtools: { clientAuth: false },
  plugins: [Vue(), medula()],
})
