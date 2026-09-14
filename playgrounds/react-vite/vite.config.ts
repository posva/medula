import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { Medula } from 'medula/vite'

export default defineConfig({
  plugins: [react(), Medula()],
  server: { port: 5174 },
})
