import { useSyncExternalStore } from 'react'

export interface Settings {
  theme: 'light' | 'dark'
  fontSize: number
}

// tiny external store, no devtools code
function createStore<T>(initial: T) {
  let state = initial
  const listeners = new Set<() => void>()
  return {
    getState: () => state,
    setState(value: T) {
      state = value
      for (const l of listeners) l()
    },
    subscribe(listener: () => void) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
  }
}

export const settingsStore = createStore<Settings>({ theme: 'light', fontSize: 16 })

export function useSettings(): Settings {
  return useSyncExternalStore(settingsStore.subscribe, settingsStore.getState)
}
