export interface ExposedStateOptions<T = unknown> {
  /** Read the current value. Must return a JSON-friendly value. */
  get: () => T
  /** Replace the whole value. */
  set: (value: T) => void
  /** Tells the agent what this state is and how to use it. */
  description?: string
}

export interface ExposedState<T = unknown> extends ExposedStateOptions<T> {
  name: string
}

interface Registry {
  states: Map<string, ExposedState>
  listeners: Set<() => void>
}

// Shared across bundles (app code + connect script) that load their own copy.
const REGISTRY_KEY = Symbol.for('medula:registry')
const registry: Registry = ((globalThis as any)[REGISTRY_KEY] ??= {
  states: new Map(),
  listeners: new Set(),
})

function notify(): void {
  for (const listener of registry.listeners) listener()
}

/**
 * Expose a piece of state to agents. Re-exposing a name replaces the previous
 * entry (HMR friendly). Returns a function that removes the entry.
 */
export function exposeState<T>(name: string, options: ExposedStateOptions<T>): () => void {
  const entry: ExposedState<T> = { name, ...options }
  registry.states.set(name, entry as ExposedState)
  notify()
  return () => {
    if (registry.states.get(name) === entry) {
      registry.states.delete(name)
      notify()
    }
  }
}

export function getExposedState(name: string): ExposedState | undefined {
  return registry.states.get(name)
}

export function listExposedStates(): ExposedState[] {
  return [...registry.states.values()]
}

export function onExposedStatesChange(listener: () => void): () => void {
  registry.listeners.add(listener)
  return () => {
    registry.listeners.delete(listener)
  }
}
