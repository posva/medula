import { piniaMcpDevtools } from 'mcp-devtools/vue'

// client only: exposes every Pinia store under its $id
export default defineNuxtPlugin(({ $pinia }) => {
  $pinia.use(piniaMcpDevtools)
})
