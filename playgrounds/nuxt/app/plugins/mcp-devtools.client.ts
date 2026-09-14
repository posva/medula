import { mcpDevtoolsVue, piniaMcpDevtools } from 'mcp-devtools/vue'

// client only: exposes every Pinia store under its $id and the component tree
export default defineNuxtPlugin(({ $pinia, vueApp }) => {
  $pinia.use(piniaMcpDevtools)
  vueApp.use(mcpDevtoolsVue)
})
