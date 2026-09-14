import { useCallback, useEffect, useRef, useState } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import { exposeState } from '../client'

export { exposeState, toJsonValue } from '../client'
export type { ExposedStateOptions, JsonValue } from '../client'

export interface ExposeStateOptions {
  /** Tells the agent what this state is and how to use it. */
  description?: string
}

/**
 * Expose an existing state/setter pair (from `useState`, `useReducer`, props...).
 * The agent always reads the latest `value`. Re-registers when `name` changes
 * and disposes on unmount.
 *
 * @example
 * const [count, dispatch] = useReducer(reducer, 0)
 * useExposeState('count', count, (n) => dispatch({ type: 'set', n }))
 */
export function useExposeState<T>(
  name: string,
  value: T,
  setValue: (value: T) => void,
  options: ExposeStateOptions = {},
): void {
  const latest = useRef({ value, setValue })
  latest.current = { value, setValue }
  const { description } = options
  useEffect(
    () =>
      exposeState<T>(name, {
        get: () => latest.current.value,
        // eager write: React applies the update later, but the agent reads back right away
        set: (v) => {
          latest.current.value = v
          latest.current.setValue(v)
        },
        description,
      }),
    [name, description],
  )
}

/**
 * `useState` that is also exposed to agents under `name`.
 *
 * @example
 * const [todos, setTodos] = useExposedState('todos', [], { description: 'Todo list' })
 */
export function useExposedState<T>(
  name: string,
  initialState: T | (() => T),
  options: ExposeStateOptions = {},
): [T, Dispatch<SetStateAction<T>>] {
  const [state, setState] = useState(initialState)
  const set = useCallback((value: T) => setState(() => value), [])
  useExposeState(name, state, set, options)
  return [state, setState]
}

export interface ExposableStore<T> {
  getState: () => T
  setState: (value: T) => void
}

/**
 * Expose a zustand-like store (`{ getState, setState }`). Returns a dispose
 * function.
 *
 * @example
 * const useCart = create(...)
 * exposeStore('cart', useCart, { description: 'Shopping cart' })
 */
export function exposeStore<T>(
  name: string,
  store: ExposableStore<T>,
  options: ExposeStateOptions = {},
): () => void {
  return exposeState<T>(name, {
    get: () => store.getState(),
    set: (value) => store.setState(value),
    description: options.description,
  })
}
