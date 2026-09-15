import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { SOLID_STORE_KEY } from './hook'
import type { SolidComputation, SolidHookStore, SolidOwner, SolidSignalState } from './hook'
import { installSolidInternals } from './internals'

const REGISTRY_KEY = Symbol.for('devframe:browser-agent-registry')

function toolIds(): string[] {
  const state = (globalThis as any)[REGISTRY_KEY] as { tools: Map<symbol, any> } | undefined
  return state
    ? [...state.tools.values()].map((t) => t.id).filter((id) => id.startsWith('medula:solid:'))
    : []
}

function tool(name: string): { invoke: (args: Record<string, unknown>) => Promise<any> } {
  const state = (globalThis as any)[REGISTRY_KEY] as { tools: Map<symbol, any> }
  const found = [...state.tools.values()].find((t) => t.id === `medula:solid:${name}`)
  if (!found) throw new Error(`missing tool ${name}`)
  return found
}

function signal(value: unknown, name?: string): SolidSignalState {
  const s: SolidSignalState = { value, observers: null }
  if (name) s.name = name
  return s
}

function owner(owner: SolidOwner | null, extra: Partial<SolidComputation> = {}): SolidComputation {
  return { fn: () => {}, pure: true, owned: null, cleanups: null, owner, context: null, ...extra }
}

function component(
  parent: SolidOwner,
  name: string,
  props: Record<string, unknown>,
  extra: Partial<SolidComputation> = {},
): SolidComputation {
  const fn = { [name]: () => {} }[name]!
  return owner(parent, { name, component: fn, props, ...extra })
}

/** Fake store the wrapper module would fill; `produce` mutates the raw object like Solid's does. */
function fakeStore(): SolidHookStore {
  const store: SolidHookStore = {
    roots: new Set(),
    subRoots: new Map(),
    unowned: [],
    listeners: new Set(),
    internal: {
      writeSignal: (s, v) => (s.value = v),
      batch: (fn) => fn(),
      untrack: (fn) => fn(),
      produce: (fn) => (state) => (fn(state), state),
    },
  }
  ;(globalThis as any)[SOLID_STORE_KEY] = store
  return store
}

function addRoot(store: SolidHookStore, root: SolidOwner): void {
  const parent = root.owner
  if (parent) {
    const set = store.subRoots.get(parent) ?? new Set()
    store.subRoots.set(parent, set)
    set.add(root)
  } else {
    store.roots.add(root)
  }
  for (const listener of store.listeners) listener()
}

describe('solid internals tools', () => {
  let store: SolidHookStore
  let dispose: () => void
  let count: SolidSignalState
  let user: SolidSignalState
  let todos: { list: number[] }
  let theme: SolidSignalState
  let renderEffect: SolidComputation

  beforeEach(() => {
    store = fakeStore()
    dispose = installSolidInternals()
    count = signal(0, 'count')
    user = signal({ name: 'Ada', address: { city: 'Paris' } })
    todos = { list: [1, 2] }
    theme = signal('light', 'theme')
  })
  afterEach(() => {
    dispose()
    delete (globalThis as any)[SOLID_STORE_KEY]
  })

  function mountApp() {
    const top: SolidOwner = { owned: [], cleanups: null, owner: null, context: null }
    // a `createRoot(() => createStore(...))` at module level: state of the root itself
    top.sourceMap = [{ value: { fontSize: 16 }, name: 'settings' }]
    const app = component(top, 'App', {
      title: 'hi',
      get children() {
        throw new Error('must not be evaluated')
      },
      get broken(): never {
        throw new Error('boom')
      },
    })
    top.owned!.push(app)
    app.sourceMap = [count, user, { value: todos, name: 'todos' }]
    const remaining = owner(app, { comparator: () => false, value: 1, name: 'remaining' })
    // compiled JSX: children are created inside a render effect
    renderEffect = owner(app, { pure: false, owned: [] })
    app.owned = [remaining, renderEffect]
    const item = component(renderEffect, 'Item', { label: 'x' })
    const forComp = component(renderEffect, 'For', { each: [] })
    renderEffect.owned!.push(item, forComp)
    // <For>: mapArray memo owning one root per item
    const mapMemo = owner(forComp, { comparator: () => false, value: [] })
    forComp.owned = [mapMemo]
    const itemRoot: SolidOwner = { owned: [], cleanups: null, owner: mapMemo, context: null }
    itemRoot.owned!.push(component(itemRoot, 'Item', { label: 'y' }))
    // solid-refresh (HMR) wraps the body in an unnamed memo that holds the signals
    const hmr = component(top, '[solid-refresh]Hmr', {})
    const refresh = owner(hmr, { comparator: () => false, owned: [] })
    refresh.sourceMap = [signal(1, 'n')]
    hmr.owned = [refresh]
    top.owned!.push(hmr)
    store.unowned.push({ name: 'theme', ref: new WeakRef(theme), signal: true })
    store.unowned.push({ name: 'palette', ref: new WeakRef(todos), signal: false })
    addRoot(store, top)
    addRoot(store, itemRoot)
  }

  it('registers the tools lazily, when the first root is recorded', () => {
    expect(toolIds()).toEqual([])
    mountApp()
    expect(toolIds().sort()).toEqual([
      'medula:solid:get-component-state',
      'medula:solid:list-components',
      'medula:solid:set-component-state',
    ])
  })

  it('lists the component tree with labels, hoisting through effects and item roots', async () => {
    mountApp()
    expect(await tool('list-components').invoke({ arg0: {} })).toEqual([
      {
        id: '1',
        name: 'App',
        state: ['count', 'signal1', 'todos'],
        derived: ['remaining'],
        props: ['title', 'children', 'broken'],
        children: [
          { id: '2', name: 'Item', state: [], derived: [], props: ['label'], children: [] },
          {
            id: '3',
            name: 'For',
            state: [],
            derived: ['memo0'],
            props: ['each'],
            children: [
              { id: '4', name: 'Item', state: [], derived: [], props: ['label'], children: [] },
            ],
          },
        ],
      },
      { id: '5', name: 'Hmr', state: ['n'], derived: [], props: [], children: [] },
      {
        id: 'module',
        name: '(module)',
        state: ['theme', 'palette', 'settings'],
        derived: [],
        props: [],
        children: [],
      },
    ])
    // ids are stable
    const again = await tool('list-components').invoke({ arg0: {} })
    expect(again[0].children[1].children[0].id).toBe('4')
  })

  it('reads state, derived and props as JSON without evaluating children', async () => {
    mountApp()
    expect(await tool('get-component-state').invoke({ arg0: { id: '1' } })).toEqual({
      id: '1',
      name: 'App',
      props: { title: 'hi', children: null, broken: null },
      state: {
        count: 0,
        signal1: { name: 'Ada', address: { city: 'Paris' } },
        todos: { list: [1, 2] },
      },
      derived: { remaining: 1 },
    })
    expect(await tool('get-component-state').invoke({ arg0: { id: 'module' } })).toMatchObject({
      state: { theme: 'light', palette: { list: [1, 2] }, settings: { fontSize: 16 } },
    })
    await expect(tool('get-component-state').invoke({ arg0: { id: '9' } })).rejects.toThrow(
      /Unknown component id "9"/,
    )
  })

  it('writes signals immutably, stores in place, module state; refuses derived', async () => {
    mountApp()
    const set = (args: Record<string, unknown>) =>
      tool('set-component-state').invoke({ arg0: args })
    expect(await set({ id: '1', label: 'count', path: [], value: 5 })).toEqual({
      id: '1',
      label: 'count',
      value: 5,
    })
    expect(count.value).toBe(5)
    const before = user.value
    await set({ id: '1', label: 'signal1', path: ['address', 'city'], value: 'Lyon' })
    expect(user.value).toEqual({ name: 'Ada', address: { city: 'Lyon' } })
    expect(user.value).not.toBe(before)
    expect((before as any).address.city).toBe('Paris')
    // stores are mutated through `produce`, so the raw object is updated in place
    await set({ id: '1', label: 'todos', path: ['list', 1], value: 20 })
    expect(todos).toEqual({ list: [1, 20] })
    expect(
      await set({ id: '1', label: 'todos', path: [], value: { list: [7], extra: 1 } }),
    ).toEqual({ id: '1', label: 'todos', value: { list: [7], extra: 1 } })
    expect(todos).toEqual({ list: [7], extra: 1 })
    await set({ id: 'module', label: 'theme', path: [], value: 'dark' })
    expect(theme.value).toBe('dark')
    await expect(set({ id: '1', label: 'remaining', path: [], value: 3 })).rejects.toThrow(
      /read-only/,
    )
    await expect(set({ id: '1', label: 'nope', path: [], value: 'x' })).rejects.toThrow(
      /no state "nope"/,
    )
    await expect(
      set({ id: '1', label: 'todos', path: ['missing', 'x'], value: 1 }),
    ).rejects.toThrow(/not found/)
  })

  it('hides disposed components', async () => {
    mountApp()
    await tool('list-components').invoke({ arg0: {} })
    // `cleanNode` drops the child from its parent's `owned`
    renderEffect.owned = renderEffect.owned!.filter((c) => c.name !== 'Item')
    const list = await tool('list-components').invoke({ arg0: {} })
    expect(list[0].children.map((c: any) => c.name)).toEqual(['For'])
    await expect(tool('get-component-state').invoke({ arg0: { id: '2' } })).rejects.toThrow(
      /Unknown component id "2"/,
    )
  })
})
