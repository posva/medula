import type { SolidComputation, SolidHookStore, SolidOwner, SolidSourceMapValue } from './hook'

export interface Solid2ModuleLike {
  DEV?: {
    hooks: { onOwner?: (owner: any) => void }
    getParent: (owner: any) => any
    getChildren: (owner: any) => any[]
  }
  getOwner: () => any
  isDisposed: (owner: any) => boolean
  runWithOwner: (owner: any, fn: () => void) => void
  onCleanup: (fn: () => void) => void
  untrack: <T>(fn: () => T) => T
  flush: () => void
  snapshot: (value: any) => any
  createSignal: (...args: any[]) => any
  createMemo: (...args: any[]) => any
  createStore: (...args: any[]) => any
  createOptimistic: (...args: any[]) => any
  createOptimisticStore: (...args: any[]) => any
  createProjection: (...args: any[]) => any
}

export type Solid2Primitives = Pick<
  Solid2ModuleLike,
  | 'createSignal'
  | 'createMemo'
  | 'createStore'
  | 'createOptimistic'
  | 'createOptimisticStore'
  | 'createProjection'
>

/** Self-contained: inlined into the app's runtime wrapper. */
export function installSolid2RuntimeHook(
  solid: Solid2ModuleLike,
  target: typeof globalThis = globalThis,
): Solid2Primitives {
  const dev = solid.DEV
  if (!dev || !dev.getChildren) return solid
  const g = target as unknown as Record<symbol, any>
  const store: SolidHookStore = (g[Symbol.for('medula:solid')] ??= {
    roots: new Set(),
    subRoots: new Map(),
    unowned: [],
    listeners: new Set(),
  })
  const cacheKey = Symbol.for('medula:solid2-wrappers')
  const cache: WeakMap<
    object,
    {
      store: SolidHookStore
      owners: WeakMap<object, SolidComputation>
      records: WeakMap<object, SolidSourceMapValue>
      wrappers: WeakMap<object, Solid2Primitives>
    }
  > = (g[cacheKey] ??= new WeakMap())
  let context = cache.get(dev)
  const installed = context?.store === store
  if (!installed) {
    context = { store, owners: new WeakMap(), records: new WeakMap(), wrappers: new WeakMap() }
    cache.set(dev, context)
  }
  const { owners, records, wrappers } = context!
  const cached = wrappers.get(solid)
  if (cached) return cached
  const announce = () => {
    for (const listener of store.listeners) listener()
  }
  const normalize = (owner: any): SolidComputation => {
    let result = owners.get(owner)
    if (result) return result
    result = {
      fn: () => {},
      pure: false,
      cleanups: null,
      context: null,
      get owner() {
        const parent = dev.getParent(owner)
        return parent ? normalize(parent) : null
      },
      get owned() {
        return dev
          .getChildren(owner)
          .filter((child) => !solid.isDisposed(child))
          .map(normalize)
      },
      get name() {
        return owner._component?.name
      },
      get component() {
        return owner._component?.fn
      },
      get props() {
        return owner._component?.props
      },
      sourceMap: [],
    }
    owners.set(owner, result)
    return result
  }
  store.internal ??= {
    untrack: solid.untrack,
    writeSignal: () => {
      throw new Error('[medula] Solid 2 signal setter was not captured.')
    },
    batch: (fn) => {
      const result = fn()
      solid.flush()
      return result
    },
    produce: () => {
      throw new Error('[medula] Solid 2 store setter was not captured.')
    },
  }
  const previous = dev.hooks.onOwner
  if (!installed) {
    dev.hooks.onOwner = (owner) => {
      previous?.(owner)
      if (dev.getParent(owner)) return
      const container: SolidOwner = {
        owner: null,
        context: null,
        cleanups: null,
        get owned() {
          return solid.isDisposed(owner) ? [] : [normalize(owner)]
        },
      }
      store.roots.add(container)
      solid.runWithOwner(owner, () => solid.onCleanup(() => store.roots.delete(container)))
      announce()
    }
  }
  const wrap =
    (name: keyof Solid2Primitives) =>
    (...args: any[]) => {
      const owner = solid.getOwner()
      const result = solid[name](...args)
      const tuple = name !== 'createProjection' && name !== 'createMemo'
      const accessor = tuple ? result[0] : result
      const setter = tuple ? result[1] : undefined
      const isStore =
        name === 'createStore' || name === 'createOptimisticStore' || name === 'createProjection'
      const options = args[isStore && typeof args[0] === 'function' ? 2 : 1]
      const read = () => solid.untrack(() => (isStore ? solid.snapshot(accessor) : accessor()))
      const record: SolidSourceMapValue = {
        name: options?.name,
        readonly: !setter,
        get value() {
          try {
            return read()
          } catch {
            return null
          }
        },
        ...(isStore ? {} : { observers: null }),
        ...(setter
          ? {
              edit: (update: (value: any) => any) => {
                if (isStore) {
                  setter((draft: any) => {
                    update(draft)
                  })
                } else setter(() => update(read()))
                solid.flush()
              },
            }
          : {}),
      }
      records.set(accessor, record)
      if (owner) normalize(owner).sourceMap!.push(record)
      else store.unowned.push({ ref: new WeakRef(record), signal: true, name: record.name })
      announce()
      return result
    }
  const wrapped: Solid2Primitives = {
    createSignal: wrap('createSignal'),
    createMemo: wrap('createMemo'),
    createStore: wrap('createStore'),
    createOptimistic: wrap('createOptimistic'),
    createOptimisticStore: wrap('createOptimisticStore'),
    createProjection: wrap('createProjection'),
  }
  wrappers.set(solid, wrapped)
  return wrapped
}
