import { act, createElement, useReducer, useState, useSyncExternalStore } from 'react'
import type { Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { REACT_DEVTOOLS_HOOK_SCRIPT, installReactDevtoolsHook } from './hook'
import { installReactInternals } from './internals'

;(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true

const REGISTRY_KEY = Symbol.for('devframe:browser-agent-registry')

function reactToolIds(): string[] {
  const state = (globalThis as any)[REGISTRY_KEY] as { tools: Map<symbol, any> } | undefined
  return state
    ? [...state.tools.values()].map((t) => t.id).filter((id) => id.startsWith('medula:react:'))
    : []
}

function tool(name: string): { invoke: (args: Record<string, unknown>) => Promise<any> } {
  const state = (globalThis as any)[REGISTRY_KEY] as { tools: Map<symbol, any> }
  const found = [...state.tools.values()].find((t) => t.id === `medula:react:${name}`)
  if (!found) throw new Error(`missing tool ${name}`)
  return found
}

// the hook must exist before react-dom evaluates; the tools wait for a renderer
installReactDevtoolsHook()
const disposeEarly = installReactInternals()
const toolsBeforeReact = reactToolIds()
const { createRoot } = await import('react-dom/client')
const toolsAfterReact = reactToolIds()
disposeEarly()
const toolsAfterDispose = reactToolIds()

function Counter({ label }: { label: string }) {
  const [count, setCount] = useState(0)
  const [step, dispatch] = useReducer((s: number, by: number) => s + by, 1)
  return createElement(
    'button',
    { onClick: () => (setCount((value) => value + step), dispatch(1)) },
    `${label}:${count}:${step}`,
  )
}

function Child({ user }: { user: { name: string } }) {
  return createElement('p', null, user.name)
}

function App() {
  return createElement(
    'div',
    null,
    createElement(Counter, { label: 'a' }),
    createElement(Child, { user: { name: 'Ada' } }),
  )
}

let container: HTMLElement
let root: Root
let dispose: () => void

beforeEach(() => {
  dispose = installReactInternals()
  container = document.createElement('div')
  document.body.append(container)
  root = createRoot(container)
  act(() => root.render(createElement(App)))
})

afterEach(() => {
  act(() => root.unmount())
  container.remove()
  dispose()
})

describe('lazy registration', () => {
  it('registers the react tools once a renderer injects', () => {
    expect(toolsBeforeReact).toEqual([])
    expect(toolsAfterReact.sort()).toEqual([
      'medula:react:get-component',
      'medula:react:list-components',
      'medula:react:set-hook-state',
      'medula:react:set-props',
    ])
    // disposed above: gone until installed again
    expect(toolsAfterDispose).toEqual([])
    // beforeEach installed again: the recorded renderer is replayed at once
    expect(reactToolIds()).toHaveLength(4)
    expect(installReactInternals()).toBe(dispose)
  })

  it('records renderers for late subscribers', () => {
    const store = (globalThis as any)[Symbol.for('medula:react-hook')]
    expect(store.renderers.size).toBeGreaterThan(0)
  })
})

describe('hook script', () => {
  it('is self-contained', () => {
    expect(REACT_DEVTOOLS_HOOK_SCRIPT).toContain('__REACT_DEVTOOLS_GLOBAL_HOOK__')
    expect(REACT_DEVTOOLS_HOOK_SCRIPT).not.toMatch(/\bimport\b|\brequire\(/)
    const g: any = {}
    new Function('globalThis', REACT_DEVTOOLS_HOOK_SCRIPT)(g)
    expect(g.__REACT_DEVTOOLS_GLOBAL_HOOK__.supportsFiber).toBe(true)
  })
})

describe('react internals tools', () => {
  it('waits for a later application root before returning the merged tree', async () => {
    vi.useFakeTimers()
    const appContainer = document.createElement('div')
    document.body.append(appContainer)
    const appRoot = createRoot(appContainer)
    try {
      act(() => root.render(createElement(Child, { user: { name: 'Overlay' } })))
      let settled = false
      const listing = tool('list-components')
        .invoke({ arg0: {} })
        .then((value) => {
          settled = true
          return value
        })
      await vi.advanceTimersByTimeAsync(100)
      expect(settled).toBe(false)
      act(() => appRoot.render(createElement(App)))
      await vi.advanceTimersByTimeAsync(500)
      const list = await listing
      expect(list.map((c: any) => c.name)).toEqual(['Child', 'App'])
      const counter = list[1].children[0]
      await act(async () => {
        await tool('set-hook-state').invoke({
          arg0: { id: counter.id, hookIndex: 0, path: [], value: 1_000_000_000 },
        })
      })
      expect(appContainer.textContent).toContain('a:1000000000:1')
      await expect(
        tool('get-component').invoke({ arg0: { id: counter.id } }),
      ).resolves.toMatchObject({
        hooks: [
          { index: 0, value: 1_000_000_000 },
          { index: 1, value: 1 },
        ],
      })
    } finally {
      act(() => appRoot.unmount())
      appContainer.remove()
      vi.useRealTimers()
    }
  })

  it('reports a readiness error while a root still has unhydrated content', async () => {
    vi.useFakeTimers()
    const hook = (globalThis as any).__REACT_DEVTOOLS_GLOBAL_HOOK__
    const [rendererId] = hook.renderers.keys()
    const hydratingRoot = {
      current: {
        tag: 3,
        memoizedState: { element: {}, isDehydrated: false },
        child: {
          tag: 13,
          memoizedState: { dehydrated: document.createComment('$') },
          child: null,
          sibling: null,
        },
        sibling: null,
      },
    }
    hook.onCommitFiberRoot(rendererId, hydratingRoot)
    try {
      const result = expect(tool('list-components').invoke({ arg0: {} })).rejects.toThrow(
        /React component discovery is not ready.*hydration/,
      )
      await Promise.all([result, vi.advanceTimersByTimeAsync(5000)])
    } finally {
      hook.getFiberRoots(rendererId).delete(hydratingRoot)
      vi.useRealTimers()
    }
  })

  it('waits for a second renderer to commit even after the discovery window', async () => {
    vi.useFakeTimers()
    const hook = (globalThis as any).__REACT_DEVTOOLS_GLOBAL_HOOK__
    const rendererId = hook.inject({})
    const lateRoot = {
      current: {
        tag: 3,
        memoizedState: { element: {} },
        sibling: null,
        child: {
          tag: 0,
          type: function LateApp() {},
          memoizedState: null,
          child: null,
          sibling: null,
        },
      },
    }
    try {
      let settled = false
      const listing = tool('list-components')
        .invoke({ arg0: {} })
        .then((value) => {
          settled = true
          return value
        })
      await vi.advanceTimersByTimeAsync(600)
      expect(settled).toBe(false)
      hook.onCommitFiberRoot(rendererId, lateRoot)
      await vi.advanceTimersByTimeAsync(500)
      expect((await listing).map((c: any) => c.name)).toEqual(['App', 'LateApp'])
    } finally {
      hook.renderers.delete(rendererId)
      hook.getFiberRoots(rendererId).delete(lateRoot)
      const store = (globalThis as any)[Symbol.for('medula:react-hook')]
      store.renderers.delete(rendererId)
      vi.useRealTimers()
    }
  })

  it('lists components with hooks and props', async () => {
    const list = await tool('list-components').invoke({ arg0: {} })
    const app = list.find((c: any) => c.name === 'App')
    expect(app).toBeDefined()
    const names = app.children.map((c: any) => c.name)
    expect(names).toEqual(['Counter', 'Child'])
    const counter = app.children[0]
    expect(counter.statefulHooks).toBe(2)
    expect(counter.propKeys).toEqual(['label'])
    expect(typeof counter.id).toBe('number')
  })

  it('reads and overrides hook state', async () => {
    const list = await tool('list-components').invoke({ arg0: {} })
    const counter = list.find((c: any) => c.name === 'App').children[0]
    const before = await tool('get-component').invoke({ arg0: { id: counter.id } })
    expect(before).toMatchObject({
      id: counter.id,
      name: 'Counter',
      props: { label: 'a' },
      hooks: [
        { index: 0, kind: 'useState', value: 0 },
        { index: 1, kind: 'useReducer', value: 1 },
      ],
    })
    let result: any
    act(() => {
      result = tool('set-hook-state').invoke({
        arg0: { id: counter.id, hookIndex: 0, path: [], value: 41 },
      })
    })
    await expect(result).resolves.toMatchObject({ index: 0, value: 41 })
    expect(container.querySelector('button')!.textContent).toBe('a:41:1')
    // the id stays stable across renders and the alternate fiber
    act(() => container.querySelector('button')!.click())
    expect(container.querySelector('button')!.textContent).toBe('a:42:2')
    const after = await tool('get-component').invoke({ arg0: { id: counter.id } })
    expect(after.hooks.map((h: any) => h.value)).toEqual([42, 2])
  })

  it('keeps edited state for functional updates after an idle render', async () => {
    function IdleCounter() {
      const [count, setCount] = useState(0)
      return createElement('button', { onClick: () => setCount((value) => value + 1) }, count)
    }
    act(() => root.render(createElement(IdleCounter)))
    const [counter] = await tool('list-components').invoke({ arg0: {} })
    await act(async () => {
      await tool('set-hook-state').invoke({
        arg0: { id: counter.id, hookIndex: 0, path: [], value: 41 },
      })
    })
    expect(container.querySelector('button')!.textContent).toBe('41')
    act(() => root.render(createElement(IdleCounter)))
    act(() => container.querySelector('button')!.click())
    expect(container.querySelector('button')!.textContent).toBe('42')
  })

  it('rejects external store snapshot writes', async () => {
    const settings = { theme: 'light' }
    const subscribe = () => () => {}
    function Settings() {
      const value = useSyncExternalStore(subscribe, () => settings)
      return createElement('p', null, value.theme)
    }
    act(() => root.render(createElement(Settings)))
    const [component] = await tool('list-components').invoke({ arg0: {} })
    const before = await tool('get-component').invoke({ arg0: { id: component.id } })
    expect(before.hooks).toEqual([{ index: 0, kind: 'other', value: settings }])
    await act(async () => {
      await expect(
        tool('set-hook-state').invoke({
          arg0: { id: component.id, hookIndex: 0, path: ['theme'], value: 'dark' },
        }),
      ).rejects.toThrow(/Only useState and useReducer/)
    })
    expect(container.querySelector('p')!.textContent).toBe('light')
    const after = await tool('get-component').invoke({ arg0: { id: component.id } })
    expect(after.hooks).toEqual(before.hooks)
  })

  it('overrides props at a path', async () => {
    const list = await tool('list-components').invoke({ arg0: {} })
    const child = list.find((c: any) => c.name === 'App').children[1]
    let result: any
    act(() => {
      result = tool('set-props').invoke({
        arg0: { id: child.id, path: ['user', 'name'], value: 'Grace' },
      })
    })
    await expect(result).resolves.toMatchObject({ props: { user: { name: 'Grace' } } })
    expect(container.querySelector('p')!.textContent).toBe('Grace')
  })

  it('rejects unknown ids', async () => {
    await expect(tool('get-component').invoke({ arg0: { id: 99_999 } })).rejects.toThrow(
      /Unknown component id/,
    )
  })
})
