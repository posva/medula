import { describe, expect, it } from 'vitest'
import { createRoot, createSignal } from 'solid-js'
import { createStore, unwrap } from 'solid-js/store'
import { getExposedState } from '../client/registry'
import { exposeSignal, exposeState, exposeStore } from './index'

describe('solid adapter', () => {
  it('re-exports exposeState', () => {
    expect(typeof exposeState).toBe('function')
  })

  describe('exposeSignal', () => {
    it('reads and writes a signal', () => {
      const [count, setCount] = createSignal(1)
      const dispose = exposeSignal('count', [count, setCount], { description: 'a counter' })
      const state = getExposedState('count')!
      expect(state.description).toBe('a counter')
      expect(state.get()).toBe(1)
      setCount(2)
      expect(state.get()).toBe(2)
      state.set(3)
      expect(count()).toBe(3)
      dispose()
      expect(getExposedState('count')).toBeUndefined()
    })

    it('sets function values as values, not updaters', () => {
      const [fn, setFn] = createSignal<() => number>(() => 1)
      const dispose = exposeSignal('fn', [fn, setFn])
      const next = () => 2
      getExposedState('fn')!.set(next)
      expect(fn()).toBe(next)
      dispose()
    })

    it('disposes with the owner', () => {
      createRoot((dispose) => {
        exposeSignal('scoped', createSignal(0))
        expect(getExposedState('scoped')).toBeDefined()
        dispose()
      })
      expect(getExposedState('scoped')).toBeUndefined()
    })
  })

  describe('exposeStore', () => {
    it('reads a plain snapshot and replaces the content on set', () => {
      const [todos, setTodos] = createStore({ list: [{ id: 1 }], filter: 'all' })
      const dispose = exposeStore('todos', [todos, setTodos], { description: 'todos' })
      const state = getExposedState('todos')!
      expect(state.description).toBe('todos')
      expect(state.get()).toEqual({ list: [{ id: 1 }], filter: 'all' })
      setTodos('filter', 'done')
      expect(state.get()).toEqual({ list: [{ id: 1 }], filter: 'done' })
      state.set({ list: [] })
      expect(unwrap(todos)).toEqual({ list: [] })
      expect(todos.filter).toBeUndefined()
      dispose()
      expect(getExposedState('todos')).toBeUndefined()
    })
  })
})
