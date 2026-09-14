import { defineConfig } from 'vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'
import { Medula } from 'medula/vite'

export default defineConfig({
  server: { port: 5175 },
  plugins: [svelte(), Medula()],
})
