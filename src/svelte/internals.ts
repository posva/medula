import type { InPageChannelProtocol } from 'devframe/in-page-channel'
import { z } from 'zod'
import type { StatePath } from '../client/path'
import { toJsonValue } from '../client/serialize'
import type { JsonValue } from '../client/serialize'
import { registerAgentTools } from '../client/tools'
import { SVELTE_STORE_KEY } from './hook'
import type {
  SvelteComponentRecord,
  SvelteHookStore,
  SvelteRuntimeInternal,
  SvelteSignalEntry,
} from './hook'

export interface SvelteComponentNode {
  id: string
  name: string
  file?: string
  /** `$state` labels (writable). */
  state: string[]
  /** `$derived` labels (read-only). */
  derived: string[]
  /** Prop names passed by the parent. */
  props: string[]
  children: SvelteComponentNode[]
}

export interface SvelteComponentState {
  id: string
  name: string
  file?: string
  props: Record<string, JsonValue>
  state: Record<string, JsonValue>
  derived: Record<string, JsonValue>
}

export interface SvelteStateValue {
  id: string
  label: string
  value: JsonValue
}

export interface MedulaSvelteProtocol extends InPageChannelProtocol {
  pageScript: {
    'list-components': () => SvelteComponentNode[]
    'get-component-state': (args: { id: string }) => SvelteComponentState
    'set-component-state': (args: {
      id: string
      label: string
      path: StatePath
      value: unknown
    }) => SvelteStateValue
  }
}

const idSchema = z.string().min(1).describe('Component id from list-components.')
const pathSchema = z
  .array(z.union([z.string(), z.number().int().nonnegative()]))
  .describe('Path inside the value: object keys and array indexes. Empty replaces the whole value.')
const jsonSchema: z.ZodType<JsonValue> = z.json()
const jsonRecord = z.record(z.string(), jsonSchema)

const componentNodeSchema: z.ZodType<SvelteComponentNode> = z.lazy(() =>
  z.object({
    id: z.string(),
    name: z.string(),
    file: z.string().optional(),
    state: z.array(z.string()),
    derived: z.array(z.string()),
    props: z.array(z.string()),
    children: z.array(componentNodeSchema),
  }),
)
const componentStateSchema = z.object({
  id: z.string(),
  name: z.string(),
  file: z.string().optional(),
  props: jsonRecord,
  state: jsonRecord,
  derived: jsonRecord,
})
const stateValueSchema = z.object({ id: z.string(), label: z.string(), value: jsonSchema })

function getStore(): SvelteHookStore {
  const g = globalThis as unknown as Record<symbol, SvelteHookStore | undefined>
  return (g[SVELTE_STORE_KEY] ??= { components: new Map(), listeners: new Set() })
}

function requireInternal(): SvelteRuntimeInternal {
  const internal = getStore().internal
  if (!internal) {
    throw new Error(
      '[medula] Svelte runtime not instrumented: this needs the Vite plugin (Medula()) and a dev build (compilerOptions.dev).',
    )
  }
  return internal
}

function requireComponent(id: string): SvelteComponentRecord {
  const record = getStore().components.get(id)
  if (!record || !record.alive) {
    throw new Error(`[medula] Unknown component id "${id}". Call list-components first.`)
  }
  return record
}

function json(value: unknown): JsonValue {
  return toJsonValue(requireInternal().snapshot(value, true))
}

function readSignal(entry: SvelteSignalEntry): JsonValue {
  return json(entry.kind === 'proxy' ? entry.value : requireInternal().get(entry.source))
}

function labels(record: SvelteComponentRecord, derived: boolean): string[] {
  return [...record.signals]
    .filter(([, entry]) => (entry.kind === 'derived') === derived)
    .map(([label]) => label)
}

function node(record: SvelteComponentRecord, all: SvelteComponentRecord[]): SvelteComponentNode {
  const out: SvelteComponentNode = {
    id: record.id,
    name: record.name,
    state: labels(record, false),
    derived: labels(record, true),
    props: Object.keys(record.props),
    children: all.filter((c) => c.parentId === record.id).map((c) => node(c, all)),
  }
  if (record.file) out.file = record.file
  return out
}

function tree(): SvelteComponentNode[] {
  const all = [...getStore().components.values()].filter((c) => c.alive)
  const ids = new Set(all.map((c) => c.id))
  // a removed parent hoists its children to the root
  return all
    .filter((c) => c.parentId === undefined || !ids.has(c.parentId))
    .map((c) => node(c, all))
}

function details(record: SvelteComponentRecord): SvelteComponentState {
  const out: SvelteComponentState = {
    id: record.id,
    name: record.name,
    props: {},
    state: {},
    derived: {},
  }
  if (record.file) out.file = record.file
  for (const key of Object.keys(record.props)) out.props[key] = json(record.props[key])
  for (const [label, entry] of record.signals) {
    out[entry.kind === 'derived' ? 'derived' : 'state'][label] = readSignal(entry)
  }
  return out
}

function isObject(value: unknown): value is Record<string | number, unknown> {
  return typeof value === 'object' && value !== null
}

/** Writes through the `$state` proxy so Svelte's deep reactivity notices. */
function writeAtPath(target: unknown, path: StatePath, value: unknown): void {
  let parent: unknown = target
  for (const key of path.slice(0, -1)) {
    parent = isObject(parent) ? parent[key] : undefined
  }
  if (!isObject(parent)) throw new Error(`[medula] Path ${JSON.stringify(path)} not found`)
  parent[path[path.length - 1]!] = value
}

/** A never-reassigned `$state` object has no signal to set: replace its contents instead. */
function replaceContents(target: object, value: unknown): void {
  if (Array.isArray(target)) {
    if (!Array.isArray(value)) throw new Error('[medula] Expected an array value')
    target.length = 0
    target.push(...value)
    return
  }
  if (!isObject(value) || Array.isArray(value)) {
    throw new Error('[medula] Expected an object value')
  }
  const record = target as Record<string, unknown>
  for (const key of Object.keys(record)) if (!(key in value)) delete record[key]
  Object.assign(record, value)
}

/**
 * Run `listener` for every recorded Svelte component, past and future. The
 * store is shared with the runtime wrapper, which may run before or after this.
 */
export function onSvelteComponent(listener: (record: SvelteComponentRecord) => void): () => void {
  const store = getStore()
  store.listeners.add(listener)
  for (const record of store.components.values()) listener(record)
  return () => {
    store.listeners.delete(listener)
  }
}

let dispose: (() => void) | undefined

/**
 * Register the `svelte` agent tools (`medula_svelte_*`): inspect and edit
 * component `$state` like a devtools would. The tools appear once the first
 * component renders through the instrumented `svelte/internal/client` (Vite
 * plugin, dev builds only). Idempotent, browser only.
 */
export function installSvelteInternals(): () => void {
  if (dispose || typeof window === 'undefined') return dispose ?? (() => {})
  let stopTools: (() => void) | undefined
  const stopListening = onSvelteComponent(() => {
    stopTools ??= registerTools()
  })
  dispose = () => {
    stopListening()
    stopTools?.()
    dispose = undefined
  }
  return dispose
}

function registerTools(): () => void {
  return registerAgentTools<MedulaSvelteProtocol>('svelte', {
    'list-components': {
      type: 'query',
      jsonSerializable: true,
      args: [z.object({}).describe('No arguments.')],
      returns: z.array(componentNodeSchema),
      agent: {
        title: 'List Svelte components',
        description:
          'Tree of the mounted Svelte 5 components with the labels of their `$state` (writable) and `$derived` (read-only) variables and their prop names. Ids are stable while a component stays mounted. Module-level `$state` (`.svelte.ts` files) shows under the pseudo component "module". Flow: list-components -> get-component-state -> set-component-state.',
      },
      handler: () => tree(),
    },
    'get-component-state': {
      type: 'query',
      jsonSerializable: true,
      args: [z.object({ id: idSchema })],
      returns: componentStateSchema,
      agent: {
        title: 'Inspect a Svelte component',
        description:
          'Snapshot of one component (id from list-components): `state` (`$state` variables, writable with set-component-state), `derived` (`$derived`, read-only: change the state it depends on) and `props` as passed by the parent (read-only, fallback values not shown).',
      },
      handler: ({ id }) => details(requireComponent(id)),
    },
    'set-component-state': {
      type: 'action',
      jsonSerializable: true,
      args: [
        z.object({
          id: idSchema,
          label: z.string().min(1).describe('A `state` label from get-component-state.'),
          path: pathSchema,
          value: jsonSchema.describe('New JSON value written at the path.'),
        }),
      ],
      returns: stateValueSchema,
      agent: {
        title: 'Set Svelte component state',
        description:
          'Write a JSON value into a `$state` variable of a component, like editing it in a devtools; the UI and its `$derived` values update. Empty `path` replaces the whole value (an object `$state` that the component never reassigns is replaced in place). Nested paths mutate through the reactive proxy. `derived` and `props` are read-only. Returns the new value.',
      },
      handler: ({ id, label, path, value }) => {
        const record = requireComponent(id)
        const entry = record.signals.get(label)
        if (!entry) {
          throw new Error(
            `[medula] Component ${id} (${record.name}) has no $state "${label}". Call get-component-state to see its labels.`,
          )
        }
        if (entry.kind === 'derived') {
          throw new Error(
            `[medula] "${label}" is a $derived: read-only. Change the $state it depends on.`,
          )
        }
        const internal = requireInternal()
        if (entry.kind === 'state') {
          if (path.length === 0) internal.set(entry.source, value, true)
          else writeAtPath(internal.get(entry.source), path, value)
        } else if (path.length === 0) {
          replaceContents(entry.value!, value)
        } else {
          writeAtPath(entry.value, path, value)
        }
        return { id, label, value: readSignal(entry) }
      },
    },
  })
}
