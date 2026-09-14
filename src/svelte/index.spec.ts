import { describe, expect, it } from 'vitest'
import { get, readable, writable } from 'svelte/store'
import { getExposedState } from '../client/registry'
import { exposeRune, exposeState, exposeStore } from './index'

describe('svelte adapter', () => {
  it('re-exports exposeState', () => {
    expect(typeof exposeState).toBe('function')
  })

  describe('exposeStore', () => {
    it('reads and writes a writable store', () => {
      const store = writable(1)
      const dispose = exposeStore('count', store, { description: 'a counter' })
      const state = getExposedState('count')!
      expect(state.description).toBe('a counter')
      expect(state.get()).toBe(1)
      store.set(2)
      expect(state.get()).toBe(2)
      state.set(3)
      expect(get(store)).toBe(3)
      dispose()
      expect(getExposedState('count')).toBeUndefined()
    })

    it('exposes a readable store as read-only', () => {
      const store = readable({ a: 1 })
      const dispose = exposeStore('ro', store)
      const state = getExposedState('ro')!
      expect(state.get()).toEqual({ a: 1 })
      expect(() => state.set({ a: 2 })).toThrowError('"ro" is read-only')
      dispose()
    })

    it('uses options.set for a readable store', () => {
      let value = 'a'
      const store = readable(value)
      const dispose = exposeStore('custom', store, { set: (v) => (value = v) })
      getExposedState('custom')!.set('b')
      expect(value).toBe('b')
      dispose()
    })
  })

  describe('exposeRune', () => {
    it('forwards get and set', () => {
      let count = 0
      const dispose = exposeRune(
        'rune',
        { get: () => count, set: (v) => (count = v) },
        { description: 'rune' },
      )
      const state = getExposedState('rune')!
      expect(state.description).toBe('rune')
      expect(state.get()).toBe(0)
      state.set(5)
      expect(count).toBe(5)
      dispose()
      expect(getExposedState('rune')).toBeUndefined()
    })
  })
})
