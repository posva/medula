import { act, createElement, useReducer } from 'react'
import { createRoot } from 'react-dom/client'
import type { Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { getExposedState } from '../client/registry'
import { exposeStore, useExposeState, useExposedState } from './index'

;(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true

let container: HTMLElement
let root: Root

beforeEach(() => {
  container = document.createElement('div')
  document.body.append(container)
  root = createRoot(container)
})

afterEach(() => {
  act(() => root.unmount())
  container.remove()
})

function render(element: ReturnType<typeof createElement>): void {
  act(() => root.render(element))
}

describe('useExposedState', () => {
  function Counter({ name }: { name: string }) {
    const [count, setCount] = useExposedState(name, 0, { description: 'a counter' })
    return createElement('button', { onClick: () => setCount(count + 1) }, String(count))
  }

  it('exposes the state and reflects updates', () => {
    render(createElement(Counter, { name: 'count' }))
    const state = getExposedState('count')
    expect(state?.description).toBe('a counter')
    expect(state?.get()).toBe(0)
    act(() => container.querySelector('button')!.click())
    expect(getExposedState('count')?.get()).toBe(1)
    act(() => getExposedState('count')?.set(10))
    expect(container.textContent).toBe('10')
    expect(getExposedState('count')?.get()).toBe(10)
  })

  it('re-registers when the name changes and disposes on unmount', () => {
    render(createElement(Counter, { name: 'a' }))
    expect(getExposedState('a')).toBeDefined()
    render(createElement(Counter, { name: 'b' }))
    expect(getExposedState('a')).toBeUndefined()
    expect(getExposedState('b')?.get()).toBe(0)
    act(() => root.unmount())
    expect(getExposedState('b')).toBeUndefined()
  })
})

describe('useExposeState', () => {
  function Reducer() {
    const [count, dispatch] = useReducer(
      (n: number, action: 'inc' | { set: number }) => (action === 'inc' ? n + 1 : action.set),
      0,
    )
    useExposeState('reducer', count, (value) => dispatch({ set: value }))
    return createElement('button', { onClick: () => dispatch('inc') }, String(count))
  }

  it('exposes an existing state/setter pair', () => {
    render(createElement(Reducer))
    expect(getExposedState('reducer')?.get()).toBe(0)
    act(() => container.querySelector('button')!.click())
    expect(getExposedState('reducer')?.get()).toBe(1)
    act(() => getExposedState('reducer')?.set(5))
    expect(container.textContent).toBe('5')
    act(() => root.unmount())
    expect(getExposedState('reducer')).toBeUndefined()
  })
})

describe('exposeStore', () => {
  it('exposes getState/setState and disposes', () => {
    let value = { n: 1 }
    const store = { getState: () => value, setState: (v: { n: number }) => (value = v) }
    const dispose = exposeStore('store', store, { description: 'a store' })
    expect(getExposedState('store')?.get()).toEqual({ n: 1 })
    getExposedState('store')?.set({ n: 2 })
    expect(value).toEqual({ n: 2 })
    dispose()
    expect(getExposedState('store')).toBeUndefined()
  })
})
