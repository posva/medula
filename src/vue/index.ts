import { getCurrentScope, onScopeDispose } from 'vue'
import type { Ref } from 'vue'
import type { PiniaPlugin, StateTree, Store } from 'pinia'
import { exposeState } from '../client'
import { replaceInPlace } from './utils'

export { exposeState, toJsonValue } from '../client'
export type { ExposedStateOptions, JsonValue } from '../client'

export interface ExposeOptions {
  /** Tells the agent what this state is and how to use it. */
  description?: string
}

export interface ExposeStoreOptions extends ExposeOptions {
  /** Name shown to the agent. @default store.$id */
  name?: string
}

function autoDispose(dispose: () => void): () => void {
  if (getCurrentScope()) onScopeDispose(dispose)
  return dispose
}

/**
 * Expose a `ref` or `shallowRef`. Disposes with the current effect scope
 * (component, `effectScope()`), or call the returned function.
 */
export function exposeRef<T>(
  name: string,
  target: Ref<T>,
  options: ExposeOptions = {},
): () => void {
  return autoDispose(
    exposeState<T>(name, {
      description: options.description,
      get: () => target.value,
      set: (value) => {
        target.value = value
      },
    }),
  )
}

/**
 * Expose a `reactive()` object. `set` replaces its content in place so
 * existing references keep working.
 */
export function exposeReactive<T extends object>(
  name: string,
  target: T,
  options: ExposeOptions = {},
): () => void {
  return autoDispose(
    exposeState<T>(name, {
      description: options.description,
      get: () => target,
      set: (value) =>
        replaceInPlace(target as Record<string, unknown>, value as Record<string, unknown>),
    }),
  )
}

/**
 * Expose a Pinia store's `$state`. The name defaults to `store.$id`. `set`
 * replaces the whole state in one `$patch` (keys not present are removed).
 */
export function exposeStore<S extends StateTree>(
  store: Store<string, S>,
  options: ExposeStoreOptions = {},
): () => void {
  return autoDispose(
    exposeState<StateTree>(options.name ?? store.$id, {
      description: options.description,
      get: () => store.$state,
      set: (value) => {
        store.$patch((state) => replaceInPlace(state as StateTree, value))
      },
    }),
  )
}

/**
 * Pinia plugin that exposes every store under its `$id`.
 *
 * @example
 * pinia.use(piniaMcpDevtools)
 */
export const piniaMcpDevtools: PiniaPlugin = ({ store }) => {
  exposeStore(store)
}

export { installVueInternals, mcpDevtoolsVue } from './internal'
export { installPiniaInternals, piniaStateName } from './pinia'
export { installRouterInternals } from './router'
export type {
  McpDevtoolsRouterProtocol,
  NavigateTarget,
  RouteInfo,
  RouteRecordInfo,
} from './router'
export type {
  ComponentNode,
  ComponentSectionValue,
  ComponentState,
  ComponentStateSection,
  McpDevtoolsVueProtocol,
} from './internal'
