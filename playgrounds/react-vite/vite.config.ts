import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { medula } from 'medula/vite'

export default defineConfig(({ command }) => ({
  // medula is a Vite DevTools dock. Single-user localhost: no one-time code,
  // so headless agents (e2e) connect too.
  devtools: command === 'serve' ? { clientAuth: false } : false,
  plugins: [react(), medula()],
  server: { port: 5174 },
}))
