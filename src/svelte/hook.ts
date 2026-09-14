export type SvelteSignalKind = 'state' | 'derived' | 'proxy'

export interface SvelteSignalEntry {
  kind: SvelteSignalKind
  /** `$state` / `$derived` signal (`state` and `derived` kinds). */
  source?: unknown
  /** `$state` object never reassigned: the compiler keeps only the proxy (`proxy` kind). */
  value?: object
}

export interface SvelteComponentRecord {
  id: string
  name: string
  file?: string
  parentId?: string
  /** The `$$props` object as passed by the parent (getters, no fallbacks). */
  props: Record<string, unknown>
  /** Labelled signals of the component body, by `$state`/`$derived` variable name. */
  signals: Map<string, SvelteSignalEntry>
  alive: boolean
}

/** Runtime functions of the app's own `svelte/internal/client`, so no second copy is bundled. */
export interface SvelteRuntimeInternal {
  get: (signal: unknown) => unknown
  set: (signal: unknown, value: unknown, shouldProxy?: boolean) => unknown
  snapshot: (value: unknown, skipWarning?: boolean) => unknown
  proxy: <T>(value: T) => T
}

/** Shared record of mounted components, for tools that load before or after the wrapper. */
export interface SvelteHookStore {
  components: Map<string, SvelteComponentRecord>
  listeners: Set<(record: SvelteComponentRecord) => void>
  internal?: SvelteRuntimeInternal
}

/** `globalThis` key of the {@link SvelteHookStore}. */
export const SVELTE_STORE_KEY: unique symbol = Symbol.for('medula:svelte')

/** Id of the pseudo component that owns module-level `$state` (`.svelte.ts` files). */
export const SVELTE_MODULE_ID = 'module'

/** What the hook needs from the real `svelte/internal/client`. */
export interface SvelteRuntimeLike extends SvelteRuntimeInternal {
  FILENAME: symbol
  push: (props: Record<string, unknown>, runes?: boolean, fn?: Function) => void
  tag: <T>(source: T, label: string) => T
  tag_proxy: <T>(value: T, label: string) => T
}

/** What the hook needs from `svelte` (same runtime instance as the internals). */
export interface SvelteLifecycleLike {
  getContext: (key: unknown) => unknown
  setContext: (key: unknown, value: unknown) => void
  onDestroy: (fn: () => void) => void
}

export interface SvelteHookedExports {
  push: SvelteRuntimeLike['push']
  tag: SvelteRuntimeLike['tag']
  tag_proxy: SvelteRuntimeLike['tag_proxy']
}

/**
 * Wraps the dev-mode entry points of `svelte/internal/client` that compiled
 * components call: `push(props, runes, fn)` at the top of every component,
 * `tag(signal, label)` around every `$state`/`$derived` and
 * `tag_proxy(proxy, label)` around `$state` objects that are never reassigned.
 * Records each component and its labelled signals on
 * `globalThis[Symbol.for('medula:svelte')]`. The parent is found with
 * Svelte's own context (`getContext` before `setContext`), which the runtime
 * restores when a block re-renders later, and `onDestroy` removes the record.
 *
 * Self-contained on purpose: it is stringified into the wrapper module. No
 * imports, no outer names.
 */
export function installSvelteRuntimeHook(
  original: SvelteRuntimeLike,
  svelte: SvelteLifecycleLike,
  target: typeof globalThis = globalThis,
): SvelteHookedExports {
  const g = target as unknown as Record<symbol, any>
  const store: SvelteHookStore = (g[Symbol.for('medula:svelte')] ??= {
    components: new Map(),
    listeners: new Set(),
  })
  store.internal = {
    get: original.get,
    set: original.set,
    snapshot: original.snapshot,
    proxy: original.proxy,
  }
  const OWNER = Symbol.for('medula:svelte-owner')
  let uid = 0
  const announce = (record: SvelteComponentRecord) => {
    for (const listener of store.listeners) listener(record)
  }
  // id of the component whose context is current; undefined outside components
  const owner = (): string | undefined => {
    try {
      return svelte.getContext(OWNER) as string | undefined
    } catch {
      return undefined
    }
  }
  const ownerRecord = (): SvelteComponentRecord => {
    const id = owner()
    const found = id === undefined ? undefined : store.components.get(id)
    if (found) return found
    let mod = store.components.get('module')
    if (!mod) {
      mod = { id: 'module', name: '(module)', props: {}, signals: new Map(), alive: true }
      store.components.set('module', mod)
      announce(mod)
    }
    return mod
  }
  const nameOf = (fn: Function, file: unknown): string => {
    if (typeof file === 'string') {
      const base = file.split(/[\\/]/).pop() ?? ''
      return base.replace(/\.svelte$/, '') || fn.name || 'Anonymous'
    }
    return fn.name || 'Anonymous'
  }
  return {
    push(props, runes, fn) {
      original.push(props, runes, fn)
      // only dev-compiled components pass their function
      if (typeof fn !== 'function') return
      const parentId = owner()
      const id = String(++uid)
      const file = (fn as any)[original.FILENAME]
      const record: SvelteComponentRecord = {
        id,
        name: nameOf(fn, file),
        file: typeof file === 'string' ? file : undefined,
        parentId,
        props: props ?? {},
        signals: new Map(),
        alive: true,
      }
      try {
        svelte.setContext(OWNER, id)
        svelte.onDestroy(() => {
          record.alive = false
          store.components.delete(id)
        })
      } catch {
        // never break the app for a devtool
      }
      store.components.set(id, record)
      announce(record)
    },
    tag(source, label) {
      const result = original.tag(source, label)
      if (source && typeof source === 'object') {
        const kind = typeof (source as any).fn === 'function' ? 'derived' : 'state'
        ownerRecord().signals.set(label, { kind, source })
      }
      return result
    },
    tag_proxy(value, label) {
      const result = original.tag_proxy(value, label)
      if (value && typeof value === 'object') {
        ownerRecord().signals.set(label, { kind: 'proxy', value })
      }
      return result
    },
  }
}
