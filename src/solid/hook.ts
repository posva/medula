/** `registerGraph` entry: a signal (`createSignal`) or a store root (`createStore`/`createMutable`). */
export interface SolidSourceMapValue {
  value: unknown
  readonly?: boolean
  edit?: (update: (value: any) => any) => void
  name?: string
  /** The owner that created it; missing when created outside any owner. */
  graph?: SolidOwner
}

export interface SolidSignalState extends SolidSourceMapValue {
  observers: unknown[] | null
  tValue?: unknown
}

export interface SolidOwner {
  owned: SolidComputation[] | null
  cleanups: Array<() => void> | null
  owner: SolidOwner | null
  context: unknown
  /** Signals and stores created under this owner (dev only). */
  sourceMap?: SolidSourceMapValue[]
  name?: string
}

/** Memos, effects, render effects and component owners (`devComponent`). */
export interface SolidComputation extends SolidOwner {
  fn: Function
  pure: boolean
  value?: unknown
  tValue?: unknown
  /** Memos compare; effects do not. */
  comparator?: Function
  /** Component owners only. */
  props?: Record<string, unknown>
  component?: Function & { displayName?: string }
}

/** Runtime functions of the app's own `solid-js`, so no second copy is loaded. */
export interface SolidRuntimeInternal {
  writeSignal: (node: SolidSignalState, value: unknown) => unknown
  batch: <T>(fn: () => T) => T
  untrack: <T>(fn: () => T) => T
  /** `solid-js/store` `produce`: writes through Solid's `setProperty`, so stores notify. */
  produce: (fn: (draft: any) => void) => (state: any) => any
}

/** A signal or store created outside any owner, held weakly. */
export interface SolidUnownedRef {
  name?: string
  /** The signal itself, or the raw store object (its `registerGraph` entry is transient). */
  ref: WeakRef<object>
  signal: boolean
}

/** Shared record of live roots, for tools that load before or after the wrapper. */
export interface SolidHookStore {
  /** Roots without an owner (`render()`, detached `createRoot`). */
  roots: Set<SolidOwner>
  /** Nested roots by the owner that created them (`<For>` items, `<Portal>`...). */
  subRoots: Map<SolidOwner, Set<SolidOwner>>
  /** Signals and stores created outside any owner (module level). */
  unowned: SolidUnownedRef[]
  listeners: Set<() => void>
  internal?: SolidRuntimeInternal
}

/** `globalThis` key of the {@link SolidHookStore}. */
export const SOLID_STORE_KEY: unique symbol = Symbol.for('medula:solid')

/** Id of the pseudo component that owns module-level signals and root-level stores. */
export const SOLID_MODULE_ID = 'module'

/** What the hook needs from the `DEV` export of a `solid-js` development build. */
export interface SolidDevLike {
  hooks: {
    afterCreateOwner: ((owner: SolidOwner) => void) | null
    afterRegisterGraph: ((value: SolidSourceMapValue) => void) | null
  }
  writeSignal: SolidRuntimeInternal['writeSignal']
}

export interface SolidModuleLike {
  /** `undefined` in production builds. */
  DEV?: SolidDevLike
  batch: SolidRuntimeInternal['batch']
  untrack: SolidRuntimeInternal['untrack']
}

export interface SolidStoreModuleLike {
  produce: SolidRuntimeInternal['produce']
}

/**
 * Installs the `DEV.hooks` of a `solid-js` development build: every root
 * (`createRoot`, so `render()` and `<For>` items) is recorded on
 * `globalThis[Symbol.for('medula:solid')]` until it disposes, and signals or
 * stores created outside any owner are kept by weak reference. Components
 * and their signals are not recorded: the tools walk them from the roots
 * (`owned`, `sourceMap`), as Solid's own devtools do. Hooks another devtool
 * installed first keep running. Returns `false` without `DEV`.
 *
 * Self-contained on purpose: it is stringified into the wrapper module. No
 * imports, no outer names.
 */
export function installSolidRuntimeHook(
  solid: SolidModuleLike,
  storeModule: SolidStoreModuleLike,
  target: typeof globalThis = globalThis,
): boolean {
  const dev = solid.DEV
  if (!dev) return false
  const g = target as unknown as Record<symbol, any>
  const store: SolidHookStore = (g[Symbol.for('medula:solid')] ??= {
    roots: new Set(),
    subRoots: new Map(),
    unowned: [],
    listeners: new Set(),
  })
  store.internal = {
    writeSignal: dev.writeSignal,
    batch: solid.batch,
    untrack: solid.untrack,
    produce: storeModule.produce,
  }
  const HOOKED = Symbol.for('medula:solid-hooked')
  const hooks = dev.hooks as SolidDevLike['hooks'] & { [HOOKED]?: true }
  if (hooks[HOOKED]) return true
  hooks[HOOKED] = true
  const announce = () => {
    for (const listener of store.listeners) listener()
  }
  const afterCreateOwner = hooks.afterCreateOwner
  hooks.afterCreateOwner = (owner) => {
    afterCreateOwner?.(owner)
    if ('fn' in owner) return
    const parent = owner.owner
    let set: Set<SolidOwner>
    if (parent) {
      set = store.subRoots.get(parent) ?? new Set()
      store.subRoots.set(parent, set)
    } else {
      set = store.roots
    }
    set.add(owner)
    // `cleanNode` runs these when the root disposes
    ;(owner.cleanups ??= []).push(() => {
      set.delete(owner)
      if (parent && set.size === 0) store.subRoots.delete(parent)
    })
    announce()
  }
  const afterRegisterGraph = hooks.afterRegisterGraph
  hooks.afterRegisterGraph = (value) => {
    afterRegisterGraph?.(value)
    if (value.graph !== undefined || typeof WeakRef !== 'function') return
    const signal = 'observers' in value
    const target = signal ? value : value.value
    if (typeof target !== 'object' || target === null) return
    store.unowned.push({ name: value.name, ref: new WeakRef(target), signal })
    announce()
  }
  return true
}
