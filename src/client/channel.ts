import { createPageScriptChannel } from 'devframe/in-page-channel'
import type { InPageChannelProtocol } from 'devframe/in-page-channel'
import { z } from 'zod'
import { MEDULA_ID } from '../shared'
import { getAtPath, setAtPath } from './path'
import type { StatePath } from './path'
import { getExposedState, listExposedStates } from './registry'
import { previewJson, toJsonValue } from './serialize'
import type { JsonValue } from './serialize'

export const MEDULA_CHANNEL: typeof MEDULA_ID = MEDULA_ID

const nameSchema = z
  .string()
  .min(1)
  .describe('Name of an exposed state, as returned by the list tool.')

const pathSchema = z
  .array(z.union([z.string(), z.number().int().nonnegative()]))
  .describe('Path inside the state value: object keys and array indexes. Empty means the root.')

const listStatesArgs = z.object({}).describe('No arguments.')

const stateRefArgs = z.object({ name: nameSchema })

const setStateArgs = z.object({
  name: nameSchema,
  value: z.json().describe('New JSON value that replaces the whole state.'),
})

const patchStateArgs = z.object({
  name: nameSchema,
  path: pathSchema,
  value: z.json().describe('New JSON value written at the path.'),
})

const stateSummarySchema = z.object({
  name: z.string(),
  description: z.string().optional(),
  preview: z.string().describe('Truncated JSON of the current value.'),
})

const stateValueSchema = z.object({
  name: z.string(),
  value: z.json(),
})

export interface StateSummary {
  name: string
  description?: string
  /** Truncated JSON of the current value. */
  preview: string
}

export interface StateValue {
  name: string
  value: JsonValue
}

export interface MedulaChannelProtocol extends InPageChannelProtocol {
  pageScript: {
    'list-states': () => StateSummary[]
    'get-state': (args: { name: string }) => StateValue
    'set-state': (args: { name: string; value: unknown }) => StateValue
    'patch-state': (args: { name: string; path: StatePath; value: unknown }) => StateValue
  }
}

function requireState(name: string) {
  const state = getExposedState(name)
  if (!state) {
    const names = listExposedStates().map((s) => s.name)
    throw new Error(
      `[medula] Unknown state "${name}". Exposed states: ${names.length ? names.join(', ') : 'none'}.`,
    )
  }
  return state
}

function readState(name: string): StateValue {
  return { name, value: toJsonValue(requireState(name).get()) }
}

export type MedulaChannel = ReturnType<typeof createPageScriptChannel<MedulaChannelProtocol>>

// one channel per page even when several bundles load this module
const CHANNEL_KEY = Symbol.for('medula:channel')
const g = globalThis as { [CHANNEL_KEY]?: MedulaChannel }

/**
 * Create the in-page channel once. Its `agent` functions become MCP tools as
 * soon as a devframe RPC client runs in the page (see `connect.js`).
 */
export function ensureChannel(): MedulaChannel | undefined {
  if (g[CHANNEL_KEY] || typeof window === 'undefined') return g[CHANNEL_KEY]
  g[CHANNEL_KEY] = createPageScriptChannel<MedulaChannelProtocol>({
    name: MEDULA_CHANNEL,
    functions: {
      'list-states': {
        type: 'query',
        jsonSerializable: true,
        args: [listStatesArgs],
        returns: z.array(stateSummarySchema),
        agent: {
          title: 'List exposed states',
          description:
            'List the states the open web page exposes to agents, with a short preview of each value. Call this first to learn the state names.',
        },
        handler: () =>
          listExposedStates().map((state) => {
            const summary: StateSummary = {
              name: state.name,
              preview: previewJson(toJsonValue(state.get())),
            }
            if (state.description) summary.description = state.description
            return summary
          }),
      },
      'get-state': {
        type: 'query',
        jsonSerializable: true,
        args: [stateRefArgs],
        returns: stateValueSchema,
        agent: {
          title: 'Read a state',
          description: 'Read the full current JSON value of one exposed state by name.',
        },
        handler: ({ name }) => readState(name),
      },
      'set-state': {
        type: 'action',
        jsonSerializable: true,
        args: [setStateArgs],
        returns: stateValueSchema,
        agent: {
          title: 'Replace a state',
          description:
            'Replace the whole value of one exposed state in the open web page. The UI updates immediately. Use patch-state to change only a part.',
        },
        handler: ({ name, value }) => {
          requireState(name).set(value)
          return readState(name)
        },
      },
      'patch-state': {
        type: 'action',
        jsonSerializable: true,
        args: [patchStateArgs],
        returns: stateValueSchema,
        agent: {
          title: 'Patch a state',
          description:
            'Write a JSON value at a path inside one exposed state (object keys and array indexes) and keep the rest. Returns the full new value.',
        },
        handler: ({ name, path, value }) => {
          const state = requireState(name)
          const current = toJsonValue(state.get())
          if (path.length > 0 && getAtPath(current, path.slice(0, -1)) === undefined) {
            // creating intermediate containers is allowed but worth a warning
            console.warn(`[medula] Creating missing path ${JSON.stringify(path)} in "${name}"`)
          }
          state.set(setAtPath(current, path, value))
          return readState(name)
        },
      },
    },
  })
  return g[CHANNEL_KEY]
}
