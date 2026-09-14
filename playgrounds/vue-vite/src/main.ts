import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import './style.css'

// nothing from medula here: the Vite plugin injects the page script
createApp(App).use(createPinia()).mount('#app')
