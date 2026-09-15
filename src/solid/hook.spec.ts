import { afterEach, describe, expect, it } from 'vitest'
import { SOLID_STORE_KEY, installSolidRuntimeHook } from './hook'
import type {
  SolidDevLike,
  SolidHookStore,
  SolidOwner,
  SolidSignalState,
  SolidSourceMapValue,
} from './hook'
import { solidWrapperSource } from '../vite/solid'

/** Fake `solid-js` dev module: the `DEV` object and the runtime bits the hook keeps. */
function fakeSolid() {
  const DEV: SolidDevLike = {
    hooks: { afterCreateOwner: null, afterRegisterGraph: null },
    writeSignal: (s: any, v: unknown) => (s.value = v),
  }
  return {
    solid: { DEV, batch: <T>(fn: () => T) => fn(), untrack: <T>(fn: () => T) => fn() },
    store: { produce: (fn: (d: any) => void) => (s: any) => (fn(s), s) },
  }
}

/** Like `createRoot`: a root object, announced before its body runs. */
function root(dev: SolidDevLike, owner: SolidOwner | null = null): SolidOwner {
  const r: SolidOwner = { owned: null, cleanups: null, owner, context: null }
  dev.hooks.afterCreateOwner?.(r)
  return r
}

/** Like `createRoot`'s dispose -> `cleanNode`. */
function dispose(owner: SolidOwner): void {
  const cleanups = owner.cleanups
  owner.cleanups = null
  cleanups?.forEach((fn) => fn())
}

describe('solid runtime hook', () => {
  afterEach(() => {
    delete (globalThis as any)[SOLID_STORE_KEY]
  })

  it('does nothing without DEV (production build)', () => {
    const { store } = fakeSolid()
    expect(installSolidRuntimeHook({ batch: (f) => f(), untrack: (f) => f() }, store)).toBe(false)
    expect((globalThis as any)[SOLID_STORE_KEY]).toBeUndefined()
  })

  it('records top roots and sub roots, and forgets them on dispose', () => {
    const { solid, store } = fakeSolid()
    expect(installSolidRuntimeHook(solid, store, globalThis)).toBe(true)
    const hookStore = (globalThis as any)[SOLID_STORE_KEY] as SolidHookStore
    expect(hookStore.internal).toMatchObject({
      writeSignal: solid.DEV!.writeSignal,
      batch: solid.batch,
      untrack: solid.untrack,
      produce: store.produce,
    })
    let announced = 0
    hookStore.listeners.add(() => announced++)

    const top = root(solid.DEV!)
    // computations are not recorded: the walker finds them from the roots
    const memo = { fn: () => {}, owned: null, cleanups: null, owner: top, context: null }
    solid.DEV!.hooks.afterCreateOwner!(memo)
    const item = root(solid.DEV!, memo)
    expect([...hookStore.roots]).toEqual([top])
    expect([...hookStore.subRoots.get(memo)!]).toEqual([item])
    expect(announced).toBe(2)

    dispose(item)
    expect(hookStore.subRoots.has(memo)).toBe(false)
    dispose(top)
    expect(hookStore.roots.size).toBe(0)
  })

  it('keeps signals and stores created outside any owner', () => {
    const { solid, store } = fakeSolid()
    installSolidRuntimeHook(solid, store, globalThis)
    const hookStore = (globalThis as any)[SOLID_STORE_KEY] as SolidHookStore
    const owned: SolidSourceMapValue = { value: 1, graph: root(solid.DEV!) }
    const signal: SolidSignalState = { value: 2, name: 'theme', observers: null }
    const raw = { fontSize: 16 }
    solid.DEV!.hooks.afterRegisterGraph!(owned)
    solid.DEV!.hooks.afterRegisterGraph!(signal)
    // `createStore` registers a transient entry: only the raw object can be kept
    solid.DEV!.hooks.afterRegisterGraph!({ value: raw, name: 'settings' })
    expect(hookStore.unowned.map((e) => [e.name, e.ref.deref(), e.signal])).toEqual([
      ['theme', signal, true],
      ['settings', raw, false],
    ])
  })

  it('chains the hooks another devtool installed and installs once', () => {
    const { solid, store } = fakeSolid()
    const seen: string[] = []
    solid.DEV!.hooks.afterCreateOwner = () => seen.push('owner')
    solid.DEV!.hooks.afterRegisterGraph = () => seen.push('graph')
    installSolidRuntimeHook(solid, store, globalThis)
    const hookStore = (globalThis as any)[SOLID_STORE_KEY]
    installSolidRuntimeHook(solid, store, globalThis)
    expect((globalThis as any)[SOLID_STORE_KEY]).toBe(hookStore)
    root(solid.DEV!)
    solid.DEV!.hooks.afterRegisterGraph!({ value: 0 })
    expect(seen).toEqual(['owner', 'graph'])
    expect(hookStore.roots.size).toBe(1)
  })
})

describe('solidWrapperSource', () => {
  it('re-exports the real module and installs the hook from the same runtime', () => {
    for (const real of ['solid-js', 'solid-js/web'] as const) {
      const code = solidWrapperSource(real)
      expect(code).toContain(`export * from '${real}'`)
      expect(code).toContain(`from 'solid-js'`)
      expect(code).toContain(`from 'solid-js/store'`)
      // self-contained: the hook is inlined, nothing imported from medula
      expect(code).not.toContain('medula/')
      expect(code).toMatch(/Symbol\.for\(['"]medula:solid['"]\)/)
    }
  })
})
