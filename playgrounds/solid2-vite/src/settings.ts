import { createSignal, createStore } from 'solid-js'

// module-level signal and store shared by components: listed under the "module" pseudo component
export const [theme, setTheme] = createSignal<'light' | 'dark'>('light')
export const [settings, setSettings] = createStore({ fontSize: 16, showSettings: true })
