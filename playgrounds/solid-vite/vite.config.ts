import { defineConfig } from 'vite'
import solid from 'vite-plugin-solid'
import { medula } from 'medula/vite'

export default defineConfig(({ command }) => ({
  // medula is a Vite DevTools dock. Single-user localhost: no one-time code,
  // so headless agents (e2e) connect too.
  devtools: command === 'serve' ? { clientAuth: false } : false,
  server: { port: 5176 },
  plugins: [solid(), medula()],
}))
