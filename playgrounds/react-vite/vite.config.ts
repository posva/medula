import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { medula } from 'medula/vite'

export default defineConfig({
  // medula is a Vite DevTools dock. Single-user localhost: no one-time code,
  // so headless agents (e2e) connect too.
  devtools: { clientAuth: false },
  plugins: [react(), medula()],
  server: { port: 5174 },
})
