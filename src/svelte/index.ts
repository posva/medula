import { get } from 'svelte/store'
import type { Readable, Writable } from 'svelte/store'
import { exposeState } from '../client'

export { exposeState } from '../client'
export type { ExposedState, ExposedStateOptions } from '../client'

export interface ExposeStoreOptions<T> {
  /** Tells the agent what this state is and how to use it. */
  description?: string
  /** Required to make a `Readable` writable by agents. */
  set?: (value: T) => void
}

export interface ExposeRuneOptions {
  /** Tells the agent what this state is and how to use it. */
  description?: string
}

export interface RuneAccessors<T> {
  get: () => T
  set: (value: T) => void
}

function isWritable<T>(store: Readable<T>): store is Writable<T> {
  return typeof (store as Writable<T>).set === 'function'
}

/**
 * Expose a Svelte store. A `Writable` is read/write. A `Readable` is
 * read-only unless `options.set` is provided. Returns a dispose function.
 *
 * @example
 * const count = writable(0)
 * exposeStore('count', count, { description: 'Counter shown in the header' })
 */
export function exposeStore<T>(
  name: string,
  store: Readable<T>,
  options: ExposeStoreOptions<T> = {},
): () => void {
  const set =
    options.set ??
    (isWritable(store)
      ? (value: T) => store.set(value)
      : () => {
          throw new Error(`"${name}" is read-only`)
        })
  return exposeState<T>(name, {
    get: () => get(store),
    set,
    description: options.description,
  })
}

/**
 * Expose a rune (`$state`). Runes cannot be passed by reference, so pass
 * accessors. Returns a dispose function.
 *
 * @example
 * let count = $state(0)
 * exposeRune('count', { get: () => count, set: (v) => (count = v) })
 */
export function exposeRune<T>(
  name: string,
  accessors: RuneAccessors<T>,
  options: ExposeRuneOptions = {},
): () => void {
  return exposeState<T>(name, { ...accessors, description: options.description })
}
