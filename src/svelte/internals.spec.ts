import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { SVELTE_STORE_KEY } from './hook'
import type { SvelteComponentRecord, SvelteHookStore } from './hook'
import { installSvelteInternals } from './internals'

const REGISTRY_KEY = Symbol.for('devframe:browser-agent-registry')

function toolIds(): string[] {
  const state = (globalThis as any)[REGISTRY_KEY] as { tools: Map<symbol, any> } | undefined
  return state
    ? [...state.tools.values()]
        .map((t) => t.id)
        .filter((id) => id.startsWith('mcp-devtools:svelte:'))
    : []
}

function tool(name: string): { invoke: (args: Record<string, unknown>) => Promise<any> } {
  const state = (globalThis as any)[REGISTRY_KEY] as { tools: Map<symbol, any> }
  const found = [...state.tools.values()].find((t) => t.id === `mcp-devtools:svelte:${name}`)
  if (!found) throw new Error(`missing tool ${name}`)
  return found
}

interface FakeSource {
  v: unknown
  fn?: () => void
}

// like Svelte's snapshot: deep copy of objects/arrays, functions and primitives kept
function clone(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(clone)
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, clone(v)]))
  }
  return value
}

/** Fake store the wrapper module would fill: sources are `{ v }`, proxies are plain objects. */
function fakeStore(): SvelteHookStore {
  const store: SvelteHookStore = {
    components: new Map(),
    listeners: new Set(),
    internal: {
      get: (s) => (s as FakeSource).v,
      set: (s, v) => ((s as FakeSource).v = v),
      snapshot: clone,
      proxy: (v) => v,
    },
  }
  ;(globalThis as any)[SVELTE_STORE_KEY] = store
  return store
}

function add(store: SvelteHookStore, record: SvelteComponentRecord): SvelteComponentRecord {
  store.components.set(record.id, record)
  for (const listener of store.listeners) listener(record)
  return record
}

describe('svelte internals tools', () => {
  let store: SvelteHookStore
  let dispose: () => void
  let count: FakeSource
  let user: FakeSource
  let upper: FakeSource
  let list: number[]

  beforeEach(() => {
    store = fakeStore()
    dispose = installSvelteInternals()
    count = { v: 0 }
    user = { v: { name: 'Ada', address: { city: 'Paris' } } }
    upper = { v: 'ADA', fn: () => {} }
    list = [1, 2]
  })
  afterEach(() => {
    dispose()
    delete (globalThis as any)[SVELTE_STORE_KEY]
  })

  function mountApp() {
    add(store, {
      id: '1',
      name: 'App',
      file: 'src/App.svelte',
      props: { title: 'hi', children: () => {} },
      alive: true,
      signals: new Map([
        ['count', { kind: 'state', source: count }],
        ['user', { kind: 'state', source: user }],
        ['upper', { kind: 'derived', source: upper }],
        ['list', { kind: 'proxy', value: list }],
      ]),
    })
    add(store, {
      id: '2',
      name: 'Item',
      file: 'src/Item.svelte',
      parentId: '1',
      props: { label: 'x' },
      alive: true,
      signals: new Map(),
    })
  }

  it('registers the tools lazily, when the first component is recorded', () => {
    expect(toolIds()).toEqual([])
    mountApp()
    expect(toolIds().sort()).toEqual([
      'mcp-devtools:svelte:get-component-state',
      'mcp-devtools:svelte:list-components',
      'mcp-devtools:svelte:set-component-state',
    ])
  })

  it('lists the component tree', async () => {
    mountApp()
    expect(await tool('list-components').invoke({ arg0: {} })).toEqual([
      {
        id: '1',
        name: 'App',
        file: 'src/App.svelte',
        state: ['count', 'user', 'list'],
        derived: ['upper'],
        props: ['title', 'children'],
        children: [
          {
            id: '2',
            name: 'Item',
            file: 'src/Item.svelte',
            state: [],
            derived: [],
            props: ['label'],
            children: [],
          },
        ],
      },
    ])
  })

  it('reads state, derived and props as JSON', async () => {
    mountApp()
    expect(await tool('get-component-state').invoke({ arg0: { id: '1' } })).toEqual({
      id: '1',
      name: 'App',
      file: 'src/App.svelte',
      props: { title: 'hi', children: null },
      state: { count: 0, user: { name: 'Ada', address: { city: 'Paris' } }, list: [1, 2] },
      derived: { upper: 'ADA' },
    })
    await expect(tool('get-component-state').invoke({ arg0: { id: '9' } })).rejects.toThrow(
      /Unknown component id "9"/,
    )
  })

  it('writes state: whole value, nested path, in-place for proxies; refuses derived', async () => {
    mountApp()
    const set = (args: Record<string, unknown>) =>
      tool('set-component-state').invoke({ arg0: args })
    expect(await set({ id: '1', label: 'count', path: [], value: 5 })).toEqual({
      id: '1',
      label: 'count',
      value: 5,
    })
    expect(count.v).toBe(5)
    await set({ id: '1', label: 'user', path: ['address', 'city'], value: 'Lyon' })
    expect((user.v as any).address.city).toBe('Lyon')
    await set({
      id: '1',
      label: 'user',
      path: [],
      value: { name: 'Bob', address: { city: 'Nice' } },
    })
    expect(user.v).toEqual({ name: 'Bob', address: { city: 'Nice' } })
    // proxies cannot be reassigned: mutate in place
    await set({ id: '1', label: 'list', path: [1], value: 20 })
    expect(list).toEqual([1, 20])
    expect(await set({ id: '1', label: 'list', path: [], value: [7] })).toEqual({
      id: '1',
      label: 'list',
      value: [7],
    })
    expect(list).toEqual([7])
    await expect(set({ id: '1', label: 'upper', path: [], value: 'x' })).rejects.toThrow(
      /read-only/,
    )
    await expect(set({ id: '1', label: 'nope', path: [], value: 'x' })).rejects.toThrow(
      /no \$state "nope"/,
    )
    await expect(set({ id: '1', label: 'count', path: ['a'], value: 1 })).rejects.toThrow(
      /not found/,
    )
  })

  it('hides removed components', async () => {
    mountApp()
    store.components.delete('2')
    const list = await tool('list-components').invoke({ arg0: {} })
    expect(list[0].children).toEqual([])
  })
})
