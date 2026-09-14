import { derived, writable } from 'svelte/store'
import { exposeStore } from 'mcp-devtools/svelte'

export interface Settings {
  theme: 'light' | 'dark'
  fontSize: number
}

export const settings = writable<Settings>({ theme: 'light', fontSize: 16 })
// Writable store: agents can read and set it
exposeStore('settings', settings, {
  description: 'UI settings: theme (light|dark) and fontSize (px)',
})

export const summary = derived(settings, (s) => `${s.theme} @ ${s.fontSize}px`)
// Readable store: read-only for agents (set throws)
exposeStore('settings-summary', summary, { description: 'Derived, read-only summary of settings' })
