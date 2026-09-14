import { afterEach, describe, expect, it } from 'vitest'
import { SVELTE_STORE_KEY, installSvelteRuntimeHook } from './hook'
import type { SvelteHookStore, SvelteRuntimeLike } from './hook'
import { svelteWrapperSource } from '../vite/svelte'

const FILENAME = Symbol('filename')

/** Fake `svelte/internal/client` + the bits of `svelte` the hook uses. */
function fakeRuntime() {
  const calls: string[] = []
  // component_context stand-in: a stack of context maps that inherit from the parent
  const contexts: Array<Map<unknown, unknown>> = []
  const destroyers: Array<() => void> = []
  const original: SvelteRuntimeLike & { pop: (x?: unknown) => unknown } = {
    FILENAME,
    push(_props: unknown, _runes?: boolean, _fn?: unknown) {
      calls.push('push')
      contexts.push(new Map(contexts.at(-1)))
    },
    pop(x?: unknown) {
      contexts.pop()
      return x
    },
    tag(source: any, label: string) {
      calls.push(`tag:${label}`)
      source.label = label
      return source
    },
    tag_proxy<T>(value: T, label: string): T {
      calls.push(`tag_proxy:${label}`)
      return value
    },
    get: (s: any) => s.v,
    set: (s: any, v: unknown) => (s.v = v),
    snapshot: (v: unknown) => v,
    proxy: <T>(v: T) => v,
  }
  const svelte = {
    getContext(key: unknown) {
      const ctx = contexts.at(-1)
      if (!ctx) throw new Error('lifecycle_outside_component')
      return ctx.get(key)
    },
    setContext(key: unknown, value: unknown) {
      contexts.at(-1)!.set(key, value)
    },
    onDestroy(fn: () => void) {
      destroyers.push(fn)
    },
  }
  return { original, svelte, calls, destroyers }
}

function component(name: string, file: string): Function {
  const fn = { [name]: () => {} }[name]!
  ;(fn as any)[FILENAME] = file
  return fn
}

describe('svelte runtime hook', () => {
  afterEach(() => {
    delete (globalThis as any)[SVELTE_STORE_KEY]
  })

  it('records components, their signals and parents, and drops them on destroy', () => {
    const { original, svelte, calls, destroyers } = fakeRuntime()
    const hooked = installSvelteRuntimeHook(original, svelte, globalThis)
    const store = (globalThis as any)[SVELTE_STORE_KEY] as SvelteHookStore
    expect(store.internal?.get).toBe(original.get)
    const added: string[] = []
    store.listeners.add((c) => added.push(c.name))

    const App = component('App', 'src/App.svelte')
    // HMR wrapper: anonymous-ish name, same FILENAME
    const Child = component('wrapper', 'src/components/Child.svelte')

    const appProps = { title: 'hi' }
    hooked.push(appProps, true, App)
    const count = { v: 0 }
    expect(hooked.tag(count, 'count')).toBe(count)
    const upper = { v: 'HI', fn: () => {} }
    hooked.tag(upper, 'upper')
    const user = { name: 'Ada' }
    expect(hooked.tag_proxy(user, 'user')).toBe(user)
    // not a $state: runtime internals tag without a label owner, ignore primitives
    hooked.tag_proxy(1, 'ignored')

    hooked.push({ label: 'x' }, true, Child)
    hooked.tag({ v: 1 }, 'n')
    original.pop()
    original.pop()

    expect(calls).toEqual([
      'push',
      'tag:count',
      'tag:upper',
      'tag_proxy:user',
      'tag_proxy:ignored',
      'push',
      'tag:n',
    ])
    expect(added).toEqual(['App', 'Child'])
    const [app, child] = [...store.components.values()]
    expect(app).toMatchObject({
      name: 'App',
      file: 'src/App.svelte',
      parentId: undefined,
      alive: true,
    })
    expect(app!.props).toBe(appProps)
    expect([...app!.signals.entries()]).toEqual([
      ['count', { kind: 'state', source: count }],
      ['upper', { kind: 'derived', source: upper }],
      ['user', { kind: 'proxy', value: user }],
    ])
    expect(child).toMatchObject({ name: 'Child', parentId: app!.id })
    expect(child!.signals.get('n')).toEqual({ kind: 'state', source: { v: 1, label: 'n' } })

    // destroy order: child then parent
    destroyers[1]!()
    expect(store.components.has(child!.id)).toBe(false)
    destroyers[0]!()
    expect(store.components.size).toBe(0)
  })

  it('ignores contexts without a component function (runtime internals) and module-level state', () => {
    const { original, svelte } = fakeRuntime()
    const hooked = installSvelteRuntimeHook(original, svelte, globalThis)
    const store = (globalThis as any)[SVELTE_STORE_KEY] as SvelteHookStore
    hooked.push({}, true)
    expect(store.components.size).toBe(0)
    original.pop()
    // `.svelte.ts` module: no component context at all
    const shared = { v: 1 }
    hooked.tag(shared, 'shared')
    expect(store.components.get('module')?.signals.get('shared')).toEqual({
      kind: 'state',
      source: shared,
    })
  })

  it('is idempotent on the global store', () => {
    const { original, svelte } = fakeRuntime()
    installSvelteRuntimeHook(original, svelte, globalThis)
    const store = (globalThis as any)[SVELTE_STORE_KEY]
    installSvelteRuntimeHook(original, svelte, globalThis)
    expect((globalThis as any)[SVELTE_STORE_KEY]).toBe(store)
  })
})

describe('svelteWrapperSource', () => {
  it('re-exports the real module and overrides the hooked functions', () => {
    const code = svelteWrapperSource()
    expect(code).toContain(`from 'svelte/internal/client'`)
    expect(code).toContain(`export * from 'svelte/internal/client'`)
    expect(code).toContain(`from 'svelte'`)
    for (const name of ['push', 'tag', 'tag_proxy']) {
      expect(code).toContain(`export const ${name} =`)
    }
    // self-contained: the hook is inlined, nothing imported from mcp-devtools
    expect(code).not.toContain('mcp-devtools/')
    expect(code).toMatch(/Symbol\.for\(['"]mcp-devtools:svelte['"]\)/)
  })
})
