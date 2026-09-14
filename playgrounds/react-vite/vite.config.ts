import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { medula } from 'medula/vite'

export default defineConfig({
  plugins: [react(), medula()],
  server: { port: 5174 },
})
