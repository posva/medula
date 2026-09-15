import { getOwner, onCleanup } from 'solid-js'
import type { Accessor, Setter } from 'solid-js'
import { reconcile, unwrap } from 'solid-js/store'
import type { SetStoreFunction, Store } from 'solid-js/store'
import { exposeState } from '../client'

export { exposeState, toJsonValue } from '../client'
export type { ExposedStateOptions, JsonValue } from '../client'
export { installSolidInternals, onSolidGraph } from './internals'
export type {
  MedulaSolidProtocol,
  SolidComponentNode,
  SolidComponentState,
  SolidStateValue,
} from './internals'
export { SOLID_MODULE_ID, SOLID_STORE_KEY, installSolidRuntimeHook } from './hook'
export type {
  SolidComputation,
  SolidDevLike,
  SolidHookStore,
  SolidModuleLike,
  SolidOwner,
  SolidRuntimeInternal,
  SolidSignalState,
  SolidSourceMapValue,
  SolidStoreModuleLike,
} from './hook'

export interface ExposeOptions {
  /** Tells the agent what this state is and how to use it. */
  description?: string
}

function autoDispose(dispose: () => void): () => void {
  if (getOwner()) onCleanup(dispose)
  return dispose
}

/**
 * Expose a signal (`createSignal` tuple). Disposes with the current owner
 * (component, `createRoot`), or call the returned function.
 *
 * @example
 * const [count, setCount] = createSignal(0)
 * exposeSignal('count', [count, setCount], { description: 'Counter in the header' })
 */
export function exposeSignal<T>(
  name: string,
  [get, set]: [Accessor<T>, Setter<T>],
  options: ExposeOptions = {},
): () => void {
  return autoDispose(
    exposeState<T>(name, {
      description: options.description,
      get,
      // a function value must not be taken for an updater
      set: (value) => set(() => value),
    }),
  )
}

/**
 * Expose a store (`createStore` tuple). The agent reads a plain snapshot;
 * `set` reconciles the store with the new value (keys not present are
 * removed). Disposes with the current owner, or call the returned function.
 *
 * @example
 * const [todos, setTodos] = createStore({ list: [] })
 * exposeStore('todos', [todos, setTodos])
 */
export function exposeStore<T extends object>(
  name: string,
  [store, setStore]: [Store<T>, SetStoreFunction<T>],
  options: ExposeOptions = {},
): () => void {
  return autoDispose(
    exposeState<T>(name, {
      description: options.description,
      get: () => unwrap(store),
      set: (value) => setStore(reconcile(value)),
    }),
  )
}
