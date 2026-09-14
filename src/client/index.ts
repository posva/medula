import { ensureChannel } from './channel'
import { exposeState as register } from './registry'
import type { ExposedStateOptions } from './registry'

export { MEDULA_BASE, MEDULA_ID, connectScriptUrl } from '../shared'
export { MEDULA_CHANNEL } from './channel'
export type { MedulaChannelProtocol, StateSummary, StateValue } from './channel'
export { getAtPath, setAtPath } from './path'
export type { StatePath } from './path'
export { getExposedState, listExposedStates, onExposedStatesChange } from './registry'
export type { ExposedState, ExposedStateOptions } from './registry'
export { toJsonValue } from './serialize'
export type { JsonValue } from './serialize'

/**
 * Expose a piece of state to agents. Starts the in-page channel on first
 * call (browser only). Returns a function that removes the entry.
 *
 * @example
 * let count = 0
 * exposeState('count', { get: () => count, set: (v) => (count = v) })
 */
export function exposeState<T>(name: string, options: ExposedStateOptions<T>): () => void {
  ensureChannel()
  return register(name, options)
}
export { registerAgentTools } from './tools'
