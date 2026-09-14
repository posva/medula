import { act, createElement, useReducer, useState } from 'react'
import type { Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { REACT_DEVTOOLS_HOOK_SCRIPT, installReactDevtoolsHook } from './hook'
import { installReactInternals } from './internals'

;(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true

// the hook must exist before react-dom evaluates
installReactDevtoolsHook()
const { createRoot } = await import('react-dom/client')

const REGISTRY_KEY = Symbol.for('devframe:browser-agent-registry')

function tool(name: string): { invoke: (args: Record<string, unknown>) => Promise<any> } {
  const state = (globalThis as any)[REGISTRY_KEY] as { tools: Map<symbol, any> }
  const found = [...state.tools.values()].find((t) => t.id === `mcp-devtools:react:${name}`)
  if (!found) throw new Error(`missing tool ${name}`)
  return found
}

function Counter({ label }: { label: string }) {
  const [count, setCount] = useState(0)
  const [step, dispatch] = useReducer((s: number, by: number) => s + by, 1)
  return createElement(
    'button',
    { onClick: () => (setCount(count + step), dispatch(1)) },
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
