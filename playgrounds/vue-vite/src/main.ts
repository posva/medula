import { createApp } from 'vue'
import { createPinia } from 'pinia'
import { piniaMcpDevtools } from 'mcp-devtools/vue'
import App from './App.vue'
import './style.css'

const pinia = createPinia()
// exposes every store under its $id
pinia.use(piniaMcpDevtools)

createApp(App).use(pinia).mount('#app')
