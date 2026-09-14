import { createApp } from 'vue'
import { createPinia } from 'pinia'
import { mcpDevtoolsVue, piniaMcpDevtools } from 'mcp-devtools/vue'
import App from './App.vue'
import './style.css'

const pinia = createPinia()
// exposes every store under its $id
pinia.use(piniaMcpDevtools)

// lets agents inspect and edit any component's internal state
createApp(App).use(pinia).use(mcpDevtoolsVue).mount('#app')
