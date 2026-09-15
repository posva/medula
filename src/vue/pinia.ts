import type { App } from 'vue'
import { ensureChannel } from '../client/channel'
import { registerState } from '../client/registry'
import { replaceInPlace } from './utils'

// Pinia is not imported: duck-typed on the public store surface
interface StoreLike {
  $id: string
  $state: Record<string, unknown>
  $patch(mutator: (state: Record<string, unknown>) => void): void
}

interface PiniaLike {
  _s: Map<string, StoreLike>
  use(plugin: (context: { store: StoreLike }) => void): unknown
}

/** Name of the exposed state for a store. */
export function piniaStateName(id: string): string {
  return `pinia:${id}`
}

const seen = new WeakSet<object>()

function exposePiniaStore(store: StoreLike): () => void {
  ensureChannel()
  return registerState<Record<string, unknown>>(piniaStateName(store.$id), {
    description: `Pinia store "${store.$id}" ($state). set replaces the whole state.`,
    get: () => store.$state,
    set: (value) => store.$patch((state) => replaceInPlace(state, value)),
  })
}

/**
 * Zero config: expose every store of the Pinia installed on `app` as
 * `pinia:<id>`, now and when stores are created later. One pinia shared by
 * several apps is handled once.
 */
export function installPiniaInternals(app: App): void {
  const pinia = app.config.globalProperties.$pinia as PiniaLike | undefined
  if (!pinia || typeof pinia.use !== 'function' || !(pinia._s instanceof Map) || seen.has(pinia)) {
    return
  }
  seen.add(pinia)
  for (const store of pinia._s.values()) exposePiniaStore(store)
  pinia.use(({ store }) => {
    exposePiniaStore(store)
  })
}
